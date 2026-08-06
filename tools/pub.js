/**
 * npm run pub [-- "提交信息"]
 *   - 一键暂存 → 提交 → 推送（Cloudflare Pages 会自动部署）
 *   - 不带参数时使用默认提交信息 "pub: site update"
 *   - 没有改动时跳过提交，仅推送
 */
'use strict';

const { spawnSync } = require('child_process');

const msg =
  process.argv.slice(2).filter(a => !a.startsWith('-')).join(' ').trim() ||
  'pub: site update';

// capture=true 时捕获 stdout/stderr，否则直接继承终端输出
function git(args, capture) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

try {
  // 1. 暂存并提交
  const status = git(['status', '--porcelain'], true);
  if (status.stdout.trim()) {
    git(['add', '-A']);
    const commit = git(['commit', '-m', msg]);
    if (commit.status !== 0) throw new Error('git commit 失败');
    console.log('✓ 已提交：' + msg);
  } else {
    console.log('没有新的改动，跳过提交');
  }

  // 2. 推送
  const push = git(['push']);
  if (push.status !== 0) throw new Error('git push 失败');
  console.log('✓ 已推送到远程（Cloudflare 将自动部署）');
} catch (err) {
  console.error('✗ 发布失败：' + err.message);
  process.exit(1);
}
