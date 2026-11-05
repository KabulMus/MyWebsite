/**
 * 构建编排：build → 字体覆盖检查 → 缺字则自动重新生成子集字体 → 重建 → 复查
 * ---------------------------------------------------------------------------
 * 用法:
 *   node tools/build-all.js            # 正常构建（缺字时自动补字形）
 *   node tools/build-all.js --force    # 无条件重新生成字体（改了轴范围/特性时用）
 *   node tools/build-all.js --check    # 只检查，不生成（CI 里想单独跑时用）
 *
 * 为什么要循环两遍：
 *   子集字体是按「dist/ 里出现过的字符」生成的，所以必须先有 HTML 才能知道要收哪些字。
 *   新字符 → 重新生成字体 → @font-face 变了 → 必须再渲染一次才能把新声明注入 main.css。
 *
 * 环境依赖:
 *   正常构建只需要 Node（自托管字体文件已提交在 css/fonts/）。
 *   只有在「出现新字符」或 --force 时才需要 Python + fonttools + brotli；
 *   pip 包缺失时会自动 `pip install --user fonttools brotli` 后重试。
 *   若环境里根本没有 Python（常见于 CI），且缺的字符全是思源黑体可覆盖的 CJK，
 *   构建会降级放行；这些字符直接由 Google Fonts 的思源黑体提供。
 *   缺非中文字符仍然失败：那才是真的会回退到系统字体。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CHECK_ONLY = args.includes('--check');

function run(script, extraArgs = []) {
  return spawnSync(NODE, [script, ...extraArgs], { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
}

function runPython() {
  // Windows 上优先 python，回退 py -3
  const candidates = process.platform === 'win32'
    ? [['python', ['tools/build-fonts.py']], ['py', ['-3', 'tools/build-fonts.py']]]
    : [['python3', ['tools/build-fonts.py']], ['python', ['tools/build-fonts.py']]];
  for (const [cmd, cmdArgs] of candidates) {
    const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
    if (r.error && r.error.code === 'ENOENT') continue;
    if (r.status === 0) return 0;
    // 最常见的原因是没装 fonttools / brotli（CI 上的干净环境）：装一次再重试
    console.log('[fonts] 生成失败，尝试安装 fonttools + brotli 后重试…');
    const pip = spawnSync(cmd, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check',
      '--user', 'fonttools', 'brotli'], { cwd: ROOT, stdio: 'inherit' });
    if (pip.error || pip.status !== 0) return r.status ?? 1;
    return spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
  }
  console.error('\n[fonts] 找不到可用的 Python。');
  console.error('        本地请安装 Python 后执行：pip install fonttools brotli');
  return 127;
}

function buildHtml() {
  return run(path.join(ROOT, 'build.js'));
}

function checkFonts(quiet = false) {
  const r = spawnSync(NODE, [path.join(ROOT, 'tools/check-fonts.js'), ...(quiet ? ['--json'] : [])], {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  let report = null;
  if (quiet) {
    try { report = JSON.parse(r.stdout || 'null'); } catch { /* 解析失败按未知处理 */ }
  }
  return { ok: (r.status ?? 1) === 0, report, output: (r.stdout || '') + (r.stderr || '') };
}

/* 只有缺失字符全属于 Google Fonts 思源黑体覆盖范围时才允许放行；
   其余字符缺了就是真回退到系统字体，必须让构建失败。 */
function canFallbackToCdn(report) {
  return Boolean(report && report.remoteOnly);
}

/* ---------------------------------- 主流程 ---------------------------------- */

let status = buildHtml();
if (status !== 0) process.exit(status);

if (CHECK_ONLY) {
  const check = checkFonts(true);
  if (check.ok) {
    checkFonts();
    process.exit(0);
  }
  if (canFallbackToCdn(check.report)) {
    console.log('\n[fonts] 缺失字符均由 Google Fonts 思源黑体覆盖，无需本地生成。');
    process.exit(0);
  }
  checkFonts();
  process.exit(1);
}

const first = checkFonts(true);

if (first.ok && !FORCE) {
  checkFonts();   // 再跑一次非 JSON 版本，把人类可读的结论打出来
  process.exit(0);
}

if (!first.ok && !FORCE && canFallbackToCdn(first.report)) {
  console.log('\n[fonts] 缺失字符均由 Google Fonts 思源黑体覆盖，无需生成本地字体。');
  process.exit(0);
}

if (!first.ok) {
  console.log('\n[fonts] 检测到未覆盖字符，正在重新生成子集字体…');
} else {
  console.log('\n[fonts] --force：重新生成子集字体…');
}

const fontStatus = runPython();
if (fontStatus !== 0) {
  // 字体没生成成功。可由 Google 思源黑体覆盖的 CJK 缺字可以继续；其余缺字不能上线。
  const retry = checkFonts(true);
  if (retry.ok) {
    console.error('\n[fonts] 生成失败，但现有字体已覆盖全部字符，继续构建。');
    process.exit(0);
  }
  if (canFallbackToCdn(retry.report)) {
    console.error('\n[fonts] 生成失败，缺的字符全是 Google Fonts 思源黑体可覆盖的 CJK，继续构建。');
    process.exit(0);
  }
  console.error('\n[fonts] 生成失败，保留原有字体文件。');
  process.exit(1);
}

// 字体变了 → @font-face 变了 → 必须重新渲染，把新声明注入 dist/css/main.css
status = buildHtml();
if (status !== 0) process.exit(status);

const final = checkFonts(true);
if (final.ok) {
  checkFonts();
  process.exit(0);
}
if (canFallbackToCdn(final.report)) {
  console.log('\n[fonts] 缺失字符均由 Google Fonts 思源黑体覆盖，无需本地生成。');
  process.exit(0);
}
checkFonts();
process.exit(1);
