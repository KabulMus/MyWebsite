/**
 * 字体覆盖校验
 * -----------------
 * 越界检查：dist/ 里所有页面用到的字符，是否都被 css/fonts/ 的子集字体覆盖。
 *
 * 为什么需要它：字体子集化只收录「生成那一刻」dist/ 里出现过的字符。之后新写的文案
 * 如果带来新字符，浏览器不会报错，只会静默回退到系统字体——视觉上不一致但很难发现。
 *
 * 用法:
 *   node tools/check-fonts.js          # 检查，有缺字则退出码 1
 *   node tools/check-fonts.js --json   # 机器可读输出
 *
 * 无第三方依赖：直接解析 WOFF2 的 cmap 表（仅格式 4 / 12，足以覆盖本站字体）。
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FONT_DIR = path.join(ROOT, 'css', 'fonts');

/* ------------------------------ WOFF2 解析 ------------------------------ */

const WOFF2_KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ',
  'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp',
  'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF',
  'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc',
  'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx',
  'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[pos++];
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) return [value, pos];
  }
  throw new Error('bad UIntBase128');
}

/** 返回 WOFF2 里各表的原始数据（表偏移已按各自起点归零，可直接解析）。 */
function readWoff2Tables(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('not woff2: ' + file);

  const numTables = buf.readUInt16BE(12);
  let pos = 48;

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    // WOFF2 规范：flags 先取 tag index(6b) 与 transformVersion(2b)，
    // tag index 为 63 时紧随其后是 4 字节自定义 tag（在 transformVersion 之前读取）。
    const flags = buf[pos++];
    const tagIndex = flags & 0x3f;
    const version = (flags >> 6) & 0x03;
    let tag;
    if (tagIndex === 0x3f) {
      tag = buf.toString('ascii', pos, pos + 4);
      pos += 4;
    } else {
      tag = WOFF2_KNOWN_TAGS[tagIndex];
    }
    let origLength;
    [origLength, pos] = readBase128(buf, pos);
    let transformLength = origLength;
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    if (transformed) {
      [transformLength, pos] = readBase128(buf, pos);
    }
    tables.push({ tag, transformLength });
  }

  // 压缩流紧接目录，长度 = 整个文件剩余部分
  const compressed = buf.subarray(pos);
  const raw = zlib.brotliDecompressSync(compressed);

  const out = {};
  let off = 0;
  for (const t of tables) {
    // 解压流里各表是紧排的，没有 4 字节对齐填充
    out[t.tag] = Buffer.from(raw.subarray(off, off + t.transformLength));
    off += t.transformLength;
  }
  return out;
}

function parseCmap(data) {
  const codes = new Set();
  const numTables = data.readUInt16BE(2);
  const subtables = [];
  for (let i = 0; i < numTables; i++) {
    const p = 4 + i * 8;
    subtables.push({
      platform: data.readUInt16BE(p),
      encoding: data.readUInt16BE(p + 2),
      offset: data.readUInt32BE(p + 4),
    });
  }
  for (const st of subtables) {
    const o = st.offset;
    const format = data.readUInt16BE(o);
    if (format === 4) {
      const segX2 = data.readUInt16BE(o + 6);
      const seg = segX2 / 2;
      const endO = o + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let s = 0; s < seg; s++) {
        const end = data.readUInt16BE(endO + s * 2);
        const start = data.readUInt16BE(startO + s * 2);
        const delta = data.readInt16BE(deltaO + s * 2);
        const rangeOff = data.readUInt16BE(rangeO + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) {
          let glyph;
          if (rangeOff === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const gi = rangeO + s * 2 + rangeOff + (c - start) * 2;
            if (gi + 1 >= data.length) continue;
            glyph = data.readUInt16BE(gi);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) codes.add(c);
        }
      }
    } else if (format === 12) {
      const nGroups = data.readUInt32BE(o + 12);
      for (let g = 0; g < nGroups; g++) {
        const p = o + 16 + g * 12;
        const start = data.readUInt32BE(p);
        const end = data.readUInt32BE(p + 4);
        for (let c = start; c <= end; c++) codes.add(c);
      }
    }
  }
  return codes;
}

function fontCoverage(file) {
  const tables = readWoff2Tables(file);
  if (!tables.cmap) return { codes: new Set(), families: [] };
  return { codes: parseCmap(tables.cmap), families: fontFamilies(tables.name) };
}

/** 从 name 表里取 family 名（nameID 1 和 16）。 */
function fontFamilies(nameData) {
  if (!nameData) return [];
  const count = nameData.readUInt16BE(2);
  const strOff = nameData.readUInt16BE(4);
  const names = [];
  for (let i = 0; i < count; i++) {
    const p = 6 + i * 12;
    const platform = nameData.readUInt16BE(p);
    const nameId = nameData.readUInt16BE(p + 6);
    const length = nameData.readUInt16BE(p + 8);
    const off = nameData.readUInt16BE(p + 10);
    if (nameId !== 1 && nameId !== 16) continue;
    const raw = nameData.subarray(strOff + off, strOff + off + length);
    try {
      const s = platform === 3 || platform === 0
        ? new TextDecoder('utf-16be').decode(raw)
        : raw.toString('latin1');
      names.push(s.replace(/\u0000/g, ''));
    } catch { /* ignore */ }
  }
  return [...new Set(names)];
}

/* ------------------------------ 站点字符集 ------------------------------ */

/**
 * 不需要自托管字体覆盖的码位。
 * - 空白：不产生字形
 * - Emoji / 符号：由系统的彩色字体（Apple Color Emoji / Segoe UI Emoji / Noto Color Emoji）
 *   渲染，永远不会出现在我们的 WOFF2 里。报出来只会淹没真正的问题，所以默认跳过；
 *   用 --report-emoji 可以单独查看。
 */
const IGNORED = new Set([...' \t\n\r\f\v\u00a0\u3000']);

const EMOJI_RANGES = [
  [0x1f000, 0x1f02f], [0x1f0a0, 0x1f0ff], [0x1f100, 0x1f1ff], [0x1f200, 0x1f2ff],
  [0x1f300, 0x1f5ff], [0x1f600, 0x1f64f], [0x1f650, 0x1f67f], [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f], [0x1f780, 0x1f7ff], [0x1f800, 0x1f8ff], [0x1f900, 0x1f9ff],
  [0x1fa00, 0x1fa6f], [0x1fa70, 0x1faff], [0x1fb00, 0x1fbff],
  [0x2600, 0x27bf],   // 杂项符号与装饰符（☀ ✅ ✨ ❤ 等）
  [0x2b00, 0x2bff],   // 杂项符号与箭头（⭐ ⬆ 等）
  [0xfe00, 0xfe0f],   // 变体选择符（emoji presentation）
  [0x200d, 0x200d],   // ZWJ
  [0xe0020, 0xe007f], // tag 序列（旗帜）
];

function isEmoji(cp) {
  return EMOJI_RANGES.some(([a, b]) => cp >= a && cp <= b);
}

function makeCollector() {
  const chars = new Map(); // char -> Set(files)
  return {
    chars,
    add(text, file) {
      for (const ch of text) {
        if (!chars.has(ch)) chars.set(ch, new Set());
        chars.get(ch).add(file);
      }
    },
  };
}

/** 去掉 JS 注释（保留 http:// 这类），再取出字符串字面量。 */
function jsStringLiterals(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const noLine = noBlock.replace(/(?<![:\w])\/\/[^\n]*/g, ' ');
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(noLine)) !== null) out.push(m[2]);
  return out;
}

/**
 * 收集所有会被渲染出来的字符，来源包括：
 *   1. HTML 正文（去标签后）
 *   2. <icons> 的连字名称（图标字体靠 ligature 渲染）
 *   3. 内联 <script> 与 js/*.js 里的字符串字面量（运行时文案，如「已复制到剪贴板」）
 *   4. CSS 的 content: '...'（伪元素文案）
 * 注释不算——它们不会被渲染。
 */
function collectSiteChars() {
  const col = makeCollector();

  for (const file of walk(DIST)) {
    if (!file.endsWith('.html')) continue;
    const rel = path.relative(DIST, file);
    let html = fs.readFileSync(file, 'utf8');

    for (const m of html.matchAll(/<icons[^>]*>([\s\S]*?)<\/icons>/gi)) col.add(m[1], rel);

    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      jsStringLiterals(m[1]).forEach((s) => col.add(s, rel));
    }

    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    col.add(html.replace(/&[a-z#0-9]+;/gi, ' '), rel);
  }

  // 外部脚本（不含第三方 soundfont 数据文件）
  const jsDir = path.join(ROOT, 'js');
  if (fs.existsSync(jsDir)) {
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
      jsStringLiterals(src).forEach((s) => col.add(s, 'js/' + f));
    }
  }

  // CSS 伪元素文案
  const cssDir = path.join(ROOT, 'css');
  if (fs.existsSync(cssDir)) {
    for (const f of fs.readdirSync(cssDir)) {
      if (!f.endsWith('.css')) continue;
      const css = fs.readFileSync(path.join(cssDir, f), 'utf8');
      for (const m of css.matchAll(/content:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) {
        col.add(m[2], 'css/' + f);
      }
    }
  }

  return col.chars;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** 这些字符不需要字体：空白、以及由系统彩色字体渲染的 emoji。 */
function main() {
  const asJson = process.argv.includes('--json');
  const reportEmoji = process.argv.includes('--report-emoji');
  if (!fs.existsSync(FONT_DIR)) {
    console.error('未找到 css/fonts/，先执行 npm run fonts');
    process.exit(1);
  }

  const fonts = fs.readdirSync(FONT_DIR)
    .filter((f) => f.endsWith('.woff2'))
    .map((f) => ({ file: f, ...fontCoverage(path.join(FONT_DIR, f)) }));

  const siteChars = collectSiteChars();
  const covered = new Set();
  for (const f of fonts) for (const c of f.codes) covered.add(c);

  const missing = [];
  const emoji = [];
  for (const [ch, files] of siteChars) {
    if (IGNORED.has(ch)) continue;
    const cp = ch.codePointAt(0);
    if (covered.has(cp)) continue;
    const entry = {
      ch,
      codepoint: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      sources: [...files].sort(),
    };
    if (isEmoji(cp)) emoji.push(entry);
    else missing.push(entry);
  }
  const byCodepoint = (a, b) => a.codepoint.localeCompare(b.codepoint);
  missing.sort(byCodepoint);
  emoji.sort(byCodepoint);

  const textCount = siteChars.size - emoji.length;
  if (asJson) {
    console.log(JSON.stringify({ total: siteChars.size, textCount, missing, emoji }, null, 2));
  } else {
    if (missing.length === 0) {
      console.log(`✓ 字体覆盖完整：${textCount} 个文本字符全部命中` +
        (emoji.length ? `（另有 ${emoji.length} 个 emoji 由系统字体渲染，已跳过）` : ''));
    } else {
      console.error(`✗ 有 ${missing.length} 个字符没有被任何子集字体覆盖（会回退到系统字体）：`);
      for (const m of missing) {
        const src = m.sources.slice(0, 3).join(', ') +
          (m.sources.length > 3 ? ` 等 ${m.sources.length} 处` : '');
        console.error(`   ${m.codepoint}  ${JSON.stringify(m.ch)}  ← ${src}`);
      }
      console.error('\n修复: 执行 `npm run fonts`（或 `npm run build`，会自动补字形）');
    }
    if (emoji.length && reportEmoji) {
      console.log(`\nℹ ${emoji.length} 个 emoji/符号由系统彩色字体渲染（不需要自托管字体）：`);
      for (const e of emoji) {
        const src = e.sources.slice(0, 3).join(', ') +
          (e.sources.length > 3 ? ` 等 ${e.sources.length} 处` : '');
        console.log(`   ${e.codepoint}  ${e.ch}  ← ${src}`);
      }
    }
  }
  process.exit(missing.length === 0 ? 0 : 1);
}

main();
