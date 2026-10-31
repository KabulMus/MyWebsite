"""
字体自托管 / 子集化生成脚本
============================
用法（内容大改后重新生成，需要 Python + fonttools + brotli）:
    pip install fonttools brotli
    npm run build                # 先构建，脚本要读 dist/ 的 HTML 来提取字符集
    python tools/build-fonts.py

产物:
    css/fonts/*.woff2           子集字体（已提交到仓库，构建时不需 Python）
    css/_fonts.generated.css    @font-face 声明，由 build.js 注入 dist/css/main.css

哪些自托管、哪些走 CDN：
    * 西文/装饰字体（Inter、Google Sans Flex、Source Serif 4、Playfair、JetBrains Mono…）
      自托管：这些 family 用 Google Fonts 要先拉一份 CSS 才知道字体地址，叠加 DNS/TLS
      首字要等 3 个 RTT 以上（实测这些 CSS 在 4Mbps 下 1.15s 才完成）；自托管后同源、
      无额外连接，还能按站点实际字符裁到最小。
    * 中文思源黑体（Noto Sans SC）也自托管，但注册成独立的 family
      `Noto Sans SC Local`，字体栈里排在 Google 的 `Noto Sans SC` 之前：
      日常全部字符由本地 300 KB 子集渲染（一次下载、immutable 长缓存）；
      构建期没补上的字（CI 无 Python 时的漏网字符、或以后新增的生僻字）
      才由 Google Fonts 的分片接手。详见 src/_includes/partials/head.njk 的 cjk-font 区块。
"""

import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables
from fontTools.varLib import instancer
from fontTools import subset

OUT_FONT_DIR = os.path.join('css', 'fonts')
CACHE = os.path.join('tools', '.font-cache')
CSS_OUT = os.path.join('css', '_fonts.generated.css')

# 变量字体只保留站点实际用到的轴范围，可显著减小体积。
# Google Sans Flex 在站点只用于标题/导航（字号 ≥ ~1.5rem），且不需要光学校正到正文尺寸，
# 所以 opsz 下限收到 32；wght 只用到 400–900。ROND（圆角）轴站点不用，钉到默认 0。
# ⚠️ Google Fonts 上架的 Google Sans Flex 砍掉了 slnt 轴（只有 opsz/wdth/wght），
#    所以斜体必须从上游发布版取全轴 VF；版本号与 Google 版一致（v5.000, cedf1e9）。
AXIS_LIMITS = {
    'Google Sans Flex': {'ROND': 0, 'opsz': (32, 144), 'wdth': (25, 151), 'wght': (400, 900)},
}

# 需要额外生成「斜体面」的字体：family -> (slnt 轴取值, 输出文件名)
# 该字体的斜体是 slnt 轴（-10..0）实现的，不是独立的 ital 轴。
ITALIC_SOURCES = {
    'Google Sans Flex': (-10, 'GoogleSansFlex-italic.woff2'),
}

# 必须保留全部 OpenType 特性：站点用到 tabular-nums（tnum）、ss01、
# 中文半宽/比例标点（halt/palt）以及图标字体的 liga 连字。
# 白名单式裁剪虽然能省 40 KB，但会让这些排版特性静默失效。
LAYOUT_FEATURES = '*'

# 标题字体用 block：swap 必然「先画错字形再跳」，block 只会「晚点出现」，绝不出现字形跳变。
# 前提是它已在 <head> 里 preload（否则最坏 3s 不可见，反而更糟）。
# 斜体面不做 preload，所以保持 swap，避免斜体文字长时间不可见。
FONT_DISPLAY_BLOCK = {'Google Sans Flex'}


def font_display(family, style):
    if family in FONT_DISPLAY_BLOCK and style == 'normal':
        return 'block'
    return 'swap'


# ---------- 字符集 ----------

def collect_chars():
    """扫描 dist/ 的 HTML 正文，得到站点实际渲染的字符集。"""
    texts = []
    for p in glob.glob('dist/**/*.html', recursive=True):
        html = open(p, encoding='utf-8').read()
        # 图标字体靠 ligature 名称渲染（如 <icons>wechatpay</icons>），要在去标签前抓出来
        texts.extend(re.findall(r'<icons[^>]*>([\s\S]*?)</icons>', html, flags=re.I))
        # 内联脚本里的运行时文案（如「已复制到剪贴板」）
        for block in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', html, flags=re.I):
            texts.append(' '.join(js_strings(block)))
        html = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
        html = re.sub(r'<style[\s\S]*?</style>', ' ', html, flags=re.I)
        html = re.sub(r'<!--[\s\S]*?-->', ' ', html)
        html = re.sub(r'<[^>]+>', ' ', html)
        texts.append(html)

    # 外部脚本里的文案（跳过 soundfont 数据文件）
    for p in glob.glob('js/*.js'):
        texts.append(' '.join(js_strings(open(p, encoding='utf-8').read())))

    # CSS 伪元素文案
    for p in glob.glob('css/*.css'):
        css = open(p, encoding='utf-8').read()
        for _, body in re.findall(r'content:\s*([\'"])((?:\\.|(?!\1)[^\\])*)\1', css, flags=re.S):
            texts.append(body)

    chars = set(' '.join(texts)) | {chr(c) for c in range(0x20, 0x7f)}
    return chars


def js_strings(src):
    """取 JS 源码里的字符串字面量（先去掉注释，注释不会被渲染）。"""
    src = re.sub(r'/\*[\s\S]*?\*/', ' ', src)
    src = re.sub(r'(?<![:\w])//[^\n]*', ' ', src)
    return [m.group(2) for m in re.finditer(r'([\'"`])((?:\\.|(?!\1)[^\\])*)\1', src, flags=re.S)]


def to_ranges(chars):
    """把字符集压成 unicode-range 字符串。"""
    codes = sorted({ord(c) for c in chars})
    out = []
    start = prev = codes[0]
    for c in codes[1:]:
        if c == prev + 1:
            prev = c
            continue
        out.append((start, prev))
        start = prev = c
    out.append((start, prev))
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)


def parse_range(s):
    out = set()
    for part in (s or '').split(','):
        part = part.strip()
        if not part.startswith('U+'):
            continue
        r = part[2:]
        if '-' in r:
            a, b = r.split('-')
            out.update(range(int(a, 16), int(b, 16) + 1))
        else:
            out.add(int(r, 16))
    return out


# ---------- 下载 ----------

def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(['curl.exe', '-sSLf', '--max-time', '120', '-o', dest, url], check=True)
    return dest


CHROME_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
             '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')


def fetch_full_vf(zip_url):
    """下载字体项目的发布 zip，解出里面唯一的全轴变量字体 .ttf。

    Google Fonts 上架的 Google Sans Flex 只有 opsz/wdth/wght 三个轴，没有 slnt，
    所以斜体拿不到；上游发布版是 [ROND,opsz,slnt,wdth,wght] 全轴，版本号一致。"""
    key = re.sub(r'\W+', '_', zip_url)[-60:]
    zip_path = os.path.join(CACHE, key + '.zip')
    fetch(zip_url, zip_path)

    extract_dir = os.path.join(CACHE, key + '-x')
    marker = os.path.join(extract_dir, '.done')
    if not os.path.exists(marker):
        if os.path.isdir(extract_dir):
            shutil.rmtree(extract_dir)
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_dir)
        open(marker, 'w').close()

    for p in glob.glob(os.path.join(extract_dir, '**', '*.ttf'), recursive=True):
        if '[' in os.path.basename(p):      # 变量字体文件名里带轴列表
            return p
    raise SystemExit(f'压缩包里没找到变量字体: {zip_url}')


def google_css(url):
    """用 Chrome UA 取 woff2 版 CSS（默认 UA 会返回体积更大的 ttf）。"""
    key = re.sub(r'\W+', '_', url)[-80:]
    dest = os.path.join(CACHE, key + '.css')
    if not os.path.exists(dest):
        subprocess.run(['curl.exe', '-sSf', '--max-time', '60', '-H', 'User-Agent: ' + CHROME_UA,
                        '-o', dest, url], check=True)
    return open(dest, encoding='utf-8').read()


def iter_faces(css):
    for block in re.findall(r'@font-face\s*\{([^}]+)\}', css):
        fam = re.search(r"font-family:\s*['\"]?([^'\";]+)", block)
        weight = re.search(r'font-weight:\s*([^;]+);', block)
        style = re.search(r'font-style:\s*([^;]+);', block)
        url = re.search(r'url\((https://[^)]+)\)', block)
        urange = re.search(r'unicode-range:\s*([^;]+);', block)
        yield {
            'family': fam.group(1).strip() if fam else '',
            'weight': weight.group(1).strip() if weight else '400',
            'style': style.group(1).strip() if style else 'normal',
            'url': url.group(1) if url else None,
            'range': urange.group(1).strip() if urange else None,
        }


# ---------- 处理 ----------

def supported_chars(src, chars):
    """源字体真正覆盖的字符。Google 的 unicode-range 是通用声明，某些分片并不含其中的字符，
    直接拿去子集化会得到空字体（Chrome: OTS parsing error: glyf: zero-length table）。"""
    f = TTFont(src, lazy=True)
    cmap = f.getBestCmap() or {}
    f.close()
    return {c for c in chars if ord(c) in cmap}


def subset_face(src, chars, out, limits=None):
    chars = supported_chars(src, chars)
    if not chars:
        return False
    path = src
    tmp = None
    if limits:
        # recalcTimestamp=False: 否则每次生成都会写入当前时间，字体内容没变也换文件名，
        # 白白让 immutable 缓存失效（只有走变量字体实例化的字体受影响）。
        f = TTFont(src, recalcTimestamp=False)
        instancer.instantiateVariableFont(f, limits, inplace=True, updateFontNames=False)
        tmp = tempfile.mktemp(suffix='.ttf')
        f.save(tmp)
        path = tmp
    subset.main([path, '--text=' + ''.join(sorted(chars)), '--flavor=woff2',
                 '--output-file=' + out, '--layout-features=' + LAYOUT_FEATURES])
    if tmp and os.path.exists(tmp):
        os.remove(tmp)
    return font_is_valid(out)


def promote_substitution_to_default(path, feature_tag='ss01', default_tag='ccmp'):
    """把某个特性并入默认启用的特性，使其无需 CSS 开关就生效。

    用途：Google Sans Flex 的单层 a 放在 `ss01` 里（a → a.alt），而 ss01 默认关闭。
    把它挂到 `ccmp`（所有 shaper 都默认应用）上，斜体面就直接是单层 a，
    且不依赖任何 CSS 声明（canvas、导出等场景同样生效）。

    两个坑：
    * 不能按字形名查找——子集化会把 `a.alt` 重命名成 `glyphXXXXX`，
      所以改为「提升 ss01 特性引用的 lookup」。
    * 子集化后 `ccmp` 可能被整个丢掉（本字体没有合成需求），需要新建并注册到每个 LangSys。

    安全性：已确认该字体里只有 ss01 引用字形 `a`，`calt` 只处理 `:~` 与 `数字:`，
    因此提前替换不会破坏上下文替换。"""
    f = TTFont(path, recalcTimestamp=False)
    if 'GSUB' not in f:
        f.close()
        return False
    gsub = f['GSUB'].table
    if not gsub.FeatureList:
        f.close()
        return False

    records = gsub.FeatureList.FeatureRecord
    wanted = set()
    for fr in records:
        if fr.FeatureTag == feature_tag:
            wanted.update(fr.Feature.LookupListIndex)
    if not wanted:
        f.close()
        return False

    feature_index = None
    for i, fr in enumerate(records):
        if fr.FeatureTag != default_tag:
            continue
        feature_index = i
        for li in sorted(wanted):
            if li not in fr.Feature.LookupListIndex:
                fr.Feature.LookupListIndex.append(li)
                fr.Feature.LookupCount = len(fr.Feature.LookupListIndex)

    if feature_index is None:
        new_fr = otTables.FeatureRecord()
        new_fr.FeatureTag = default_tag
        new_fr.Feature = otTables.Feature()
        new_fr.Feature.FeatureParams = None
        new_fr.Feature.LookupListIndex = sorted(wanted)
        new_fr.Feature.LookupCount = len(new_fr.Feature.LookupListIndex)
        records.append(new_fr)
        gsub.FeatureList.FeatureCount = len(records)
        feature_index = len(records) - 1

        for si in range(gsub.ScriptList.ScriptCount):
            script = gsub.ScriptList.ScriptRecord[si].Script
            langsys = []
            if script.DefaultLangSys:
                langsys.append(script.DefaultLangSys)
            langsys.extend(lr.LangSys for lr in script.LangSysRecord)
            for ls in langsys:
                if feature_index not in ls.FeatureIndex:
                    ls.FeatureIndex.append(feature_index)
                    ls.FeatureCount = len(ls.FeatureIndex)

    f.save(path)
    f.close()
    return True


def font_is_valid(path):
    """fonttools 能读不代表浏览器（OTS）能读：只子集出 .notdef 时会得到空 glyf 表，
    Chrome 会报 'OTS parsing error: glyf: zero-length table'。这种情况直接丢弃，
    让这些字符回退到后面的字体。"""
    try:
        f = TTFont(path)
        cmap = f.getBestCmap() or {}
        has_glyf = ('glyf' not in f) or len(f.reader['glyf']) > 0
        ok = bool(cmap) and has_glyf and any(name != '.notdef' for name in cmap.values())
        f.close()
        return ok
    except Exception:
        return False


def slug(s):
    return re.sub(r'[^A-Za-z0-9]', '', s)


def main():
    os.makedirs(OUT_FONT_DIR, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    chars = collect_chars()
    codes = {ord(c) for c in chars}
    print(f'站点字符集: {len(chars)} 个（CJK {sum(1 for c in chars if 0x4E00 <= ord(c) <= 0x9FFF)} 个）')

    # family -> 源 CSS
    sources = {
        'Inter': ('rsms', 'https://rsms.me/inter/inter.css'),
        # 本地子集用独立 family 名，避免与 Google 的同名 @font-face 合并后互相覆盖
        'Noto Sans SC Local': ('vf', 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf'),
        'Google Sans Flex': ('vfg', 'https://github.com/googlefonts/googlesans-flex/releases/download/v5.000/GoogleSansFlex-v5.000.zip'),
        'Encode Sans SC': ('g', 'https://fonts.googleapis.com/css2?family=Encode+Sans+SC:wght@100..900&display=swap'),
        'Source Serif 4': ('g', 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900&display=swap'),
        'JetBrains Mono': ('g', 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap'),
        'Playfair Display': ('g', 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&text=Charlie%20Playfair%20Display&display=swap'),
        'Playfair Display SC': ('g', 'https://fonts.googleapis.com/css2?family=Playfair+Display+SC:wght@900&text=Zhou&display=swap'),
        'Noto Serif SC': ('g', 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&text=%20%2FCHJKMNPSVYacdefghilnorstu%7C%E4%B8%AD%E4%B9%90%E4%BA%BA%E4%BD%93%E4%BD%9C%E5%88%B6%E5%91%A8%E5%94%B1%E5%9B%BD%E5%AE%8B%E5%AE%B6%E5%B9%B4%E6%80%9D%E6%89%8B%E6%AD%8C%E6%B7%B1%E6%BA%90%E7%94%B7%E9%9D%92%E9%9F%B3%EF%BD%9C&display=swap'),
    }

    css_rules = []
    total = 0

    for family, (kind, src) in sources.items():
        limits = AXIS_LIMITS.get(family)

        if kind == 'rsms':
            files = [
                ('https://rsms.me/inter/font-files/InterVariable.woff2', 'normal'),
                ('https://rsms.me/inter/font-files/InterVariable-Italic.woff2', 'italic'),
            ]
            for url, style in files:
                name = 'Inter.woff2' if style == 'normal' else 'Inter-italic.woff2'
                out = os.path.join(OUT_FONT_DIR, name)
                srcfile = fetch(url, os.path.join(CACHE, os.path.basename(url)))
                if not subset_face(srcfile, chars, out):
                    print(f'  {name:32} 跳过（子集为空）'); continue
                size = os.path.getsize(out)
                total += size
                css_rules.append((family, '100 900', style, name, None))
                print(f'  {name:32} {size/1024:7.1f} KB')
            continue

        if kind == 'vf':
            srcfile = fetch(src, os.path.join(CACHE, 'NotoSansSC-VF.ttf'))
            out = os.path.join(OUT_FONT_DIR, 'NotoSansSC.woff2')
            if not subset_face(srcfile, chars, out, limits):
                raise SystemExit('NotoSansSC 子集化失败')
            size = os.path.getsize(out)
            total += size
            css_rules.append((family, '100 900', 'normal', 'NotoSansSC.woff2', None))
            print(f'  {"NotoSansSC.woff2":32} {size/1024:7.1f} KB')
            continue

        if kind == 'vfg':
            # 上游发布版全轴 VF（ROND,opsz,slnt,wdth,wght），斜体由 slnt 轴实例化得到
            srcfile = fetch_full_vf(src)
            faces = [(None, 'normal', f'{slug(family)}.woff2')]
            if family in ITALIC_SOURCES:
                slnt, it_name = ITALIC_SOURCES[family]
                faces.append((slnt, 'italic', it_name))
            for slnt, style, name in faces:
                face_limits = dict(limits or {})
                if slnt is not None:
                    face_limits['slnt'] = slnt
                else:
                    face_limits['slnt'] = 0      # 钉住普通面，否则会保留 slnt 轴
                out = os.path.join(OUT_FONT_DIR, name)
                if not subset_face(srcfile, chars, out, face_limits):
                    print(f'  {name:32} 跳过（子集为空）'); continue
                if style == 'italic' and family == 'Google Sans Flex':
                    # 斜体默认用单层 a（字体里以 ss01 提供，这里提升为默认）
                    if promote_substitution_to_default(out, 'ss01', 'ccmp'):
                        print(f'  {name:32} 单层 a 已设为默认（ss01 → ccmp）')
                size = os.path.getsize(out)
                total += size
                css_rules.append((family, '400 900', style, name, None))
                print(f'  {name:32} {size/1024:7.1f} KB')
            continue

        # Google Fonts: 只保留与站点字符有交集的分片
        css = google_css(src)
        staged = []
        for face in iter_faces(css):
            if not face['url']:
                continue
            if face['style'] == 'italic':      # 站点仅 Inter 需要斜体
                continue
            keep = (parse_range(face['range']) & codes) if face['range'] else codes
            if not keep:
                continue
            staged.append((face, keep))

        built = []
        for i, (face, keep) in enumerate(staged):
            tmp_name = f'_{slug(family)}-{i}.tmp.woff2'
            tmp_out = os.path.join(OUT_FONT_DIR, tmp_name)
            srcfile = fetch(face['url'], os.path.join(CACHE, slug(family) + f'-{i}.src'))
            if not subset_face(srcfile, {chr(c) for c in keep}, tmp_out, limits):
                print(f'  {slug(family)}#{i} 跳过（源字体不含这些字符，回退到后面的字体）')
                continue
            built.append((face, keep, tmp_out))

        # 字符最多的分片用不带序号的名字，其余带序号；这样 <link rel=preload> 的地址稳定
        built.sort(key=lambda x: -len(x[1]))
        for i, (face, keep, tmp_out) in enumerate(built):
            name = f'{slug(family)}.woff2' if i == 0 else f'{slug(family)}-{i + 1}.woff2'
            out = os.path.join(OUT_FONT_DIR, name)
            os.replace(tmp_out, out)
            size = os.path.getsize(out)
            total += size
            css_rules.append((family, face['weight'], face['style'], name, keep))
            print(f'  {name:32} {size/1024:7.1f} KB ({len(keep)} chars)')

    # ---------- 文件名加内容哈希 ----------
    # 字体内容不变就不该重新下载。文件名带内容哈希后，_headers 才能对它用
    # `max-age=31536000, immutable`（未哈希时只能短缓存，否则换字后用户长期看到旧字体）。
    manifest = {}
    hashed_rules = []
    for family, weight, style, name, keep in css_rules:
        path = os.path.join(OUT_FONT_DIR, name)
        digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()[:8]
        stem, ext = os.path.splitext(name)
        hashed = f'{stem}.{digest}{ext}'
        os.replace(path, os.path.join(OUT_FONT_DIR, hashed))
        manifest[name] = hashed
        hashed_rules.append((family, weight, style, hashed, keep))
    css_rules = hashed_rules

    # 清掉本次没有产出的旧字体（Musical / Icons 是手工维护的，不归本脚本管）
    produced = set(manifest.values())
    for stale in glob.glob(os.path.join(OUT_FONT_DIR, '*.woff2')):
        base = os.path.basename(stale)
        if base in produced or base.startswith(('Musical-', 'Icons-')):
            continue
        os.remove(stale)

    manifest_path = os.path.join(OUT_FONT_DIR, 'manifest.json')
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'\n写入 {manifest_path}')

    # ---------- 生成 @font-face ----------
    lines = ['/* 由 tools/build-fonts.py 生成，请勿手改。字体按站点实际字符子集化。 */']
    for family, weight, style, name, keep in css_rules:
        w = weight
        wght_axis = (AXIS_LIMITS.get(family) or {}).get('wght')
        if wght_axis:
            # 轴已裁到站点用到的范围，声明也要跟着收窄，否则浏览器会误以为有更细/更粗的字重
            w = f'{wght_axis[0]} {wght_axis[1]}'
        block = [
            '@font-face {',
            f"\tfont-family: '{family}';",
            f'\tfont-style: {style};',
            f'\tfont-weight: {w};',
            f'\tfont-display: {font_display(family, style)};',
            f"\tsrc: url('fonts/{name}') format('woff2');",
        ]
        if keep:
            block.append(f'\tunicode-range: {to_ranges({chr(c) for c in keep})};')
        block.append('}')
        lines.extend(block)
    open(CSS_OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    print(f'\n写入 {CSS_OUT}')
    print(f'字体合计 {total/1024:.1f} KB / {len(css_rules)} 个文件')


if __name__ == '__main__':
    main()
