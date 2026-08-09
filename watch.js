/**
 * MyWebsite 开发用「保存即构建」监听脚本
 * -------------------------------------
 * 用法:
 *   npm run watch          # 监听 src/css/js/images，保存后自动构建到 dist/
 *
 * 配合 Five Server（把服务根目录指向 dist/）即可实现「保存 → 自动构建 → 浏览器自动刷新」。
 * 注意: 监听范围不包含 dist/ 与 node_modules/，避免构建自身触发循环。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const BUILD_SCRIPT = path.join(ROOT, 'build.js');

// 需要监听的源目录/文件（dist/ 由构建生成，不监听）
const WATCH_TARGETS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'css'),
  path.join(ROOT, 'js'),
  path.join(ROOT, 'images'),
  BUILD_SCRIPT,
  path.join(ROOT, 'package.json'),
];

const IGNORE_RE = /[\\/](dist|node_modules)[\\/]/;

let building = false;
let queued = false;
let timer = null;

function build() {
  if (building) { queued = true; return; }
  building = true;
  const t0 = Date.now();
  console.log(`\n[watch] ${new Date().toLocaleTimeString()} 检测到变更，开始构建…`);
  const child = spawn(process.execPath, [BUILD_SCRIPT], { stdio: 'inherit' });
  child.on('close', (code) => {
    building = false;
    const sec = ((Date.now() - t0) / 1000).toFixed(2);
    if (code === 0) {
      console.log(`[watch] 构建完成（${sec}s），浏览器将自动刷新`);
    } else {
      console.error(`[watch] 构建失败（exit ${code}）`);
    }
    if (queued) { queued = false; build(); }
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(build, 150); // 防抖，合并连续保存
}

function onChange(root, filename) {
  if (!filename) return;
  const full = path.join(root, filename);
  if (IGNORE_RE.test(full)) return;
  schedule();
}

// Windows / Node≥20 支持递归 fs.watch；统一先尝试递归，失败则降级为逐目录监听
function watchDir(dir) {
  try {
    fs.watch(dir, { recursive: true }, (evt, filename) => onChange(dir, filename));
  } catch {
    const stack = [dir];
    const seen = new Set();
    while (stack.length) {
      const d = stack.pop();
      if (seen.has(d)) continue;
      seen.add(d);
      fs.watch(d, (evt, filename) => onChange(d, filename));
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) stack.push(path.join(d, e.name));
      }
    }
  }
  console.log('[watch] 监听:', dir);
}

for (const p of WATCH_TARGETS) {
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) {
    watchDir(p);
  } else {
    fs.watch(p, () => onChange(path.dirname(p), path.basename(p)));
  }
}

process.on('SIGINT', () => { console.log('\n[watch] 已停止'); process.exit(0); });
console.log('[watch] 已就绪：保存 src/css/js/images 将自动构建到 dist/');
