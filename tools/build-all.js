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
 *   正常构建只需要 Node（字体文件已提交在 css/fonts/）。
 *   只有在「出现新字符」或 --force 时才需要 Python + fonttools + brotli。
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
    return r.status ?? 1;
  }
  console.error('\n[fonts] 找不到可用的 Python。');
  console.error('        请在装有 Python 的环境执行：pip install fonttools brotli');
  return 127;
}

function buildHtml() {
  return run(path.join(ROOT, 'build.js'));
}

function checkFonts(quiet = false) {
  const r = spawnSync(NODE, [path.join(ROOT, 'tools/check-fonts.js')], {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  return { ok: (r.status ?? 1) === 0, output: (r.stdout || '') + (r.stderr || '') };
}

/* ---------------------------------- 主流程 ---------------------------------- */

let status = buildHtml();
if (status !== 0) process.exit(status);

if (CHECK_ONLY) {
  process.exit(checkFonts().ok ? 0 : 1);
}

const first = checkFonts(true);

if (first.ok && !FORCE) {
  process.stdout.write(first.output);
  process.exit(0);
}

if (!first.ok) {
  console.log('\n[fonts] 检测到未覆盖字符，正在重新生成子集字体…');
} else {
  console.log('\n[fonts] --force：重新生成子集字体…');
}

const fontStatus = runPython();
if (fontStatus !== 0) {
  // 字体没生成成功：把缺失清单打出来，让构建失败（不能带着缺字上线）
  console.error('\n[fonts] 生成失败，保留原有字体文件。');
  process.exit(checkFonts().ok ? 0 : 1);
}

// 字体变了 → @font-face 变了 → 必须重新渲染，把新声明注入 dist/css/main.css
status = buildHtml();
if (status !== 0) process.exit(status);

process.exit(checkFonts().ok ? 0 : 1);
