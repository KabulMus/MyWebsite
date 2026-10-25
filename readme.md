# Ethan Shaw's Personal Website | 个人主页

这是一个充满热爱的个人门户网站，展示了我的个人简介、创作频道以及一系列为音乐爱好者开发的 Web 小工具。

## 🌐 网站预览

- **Up 主**: Ethan Shaw (一名热爱音乐的中学生，「生米」)
- **核心主题**: 简洁、现代、响应式、支持深色模式
- **主要功能**: 个人动态、历程里程碑、音乐辅助工具

---

## 🔧 本地构建

网站使用 **Nunjucks 模板** 管理公共部分（导航栏 / 页脚 / 语言切换 / 主题切换按钮），源文件位于 `src/`：

- `src/_includes/` — 页面骨架与公共 partial（`layout.njk` / `nav.njk` / `footer.njk` 等）
- `src/zh/*.njk` — 中文页面正文
- `src/en/*.njk` — 英文页面正文
- `build.js` — 页面元数据（标题、样式、导航高亮、active 等）与构建逻辑

```bash
npm install     # 首次安装依赖（nunjucks）
npm run build   # 渲染全部页面到 dist/ 并复制静态资源
npm run deploy  # （可选）手动上传 dist/（host.retiehe.com）
```

## ☁️ Cloudflare Pages 自动部署（Git 集成）

在 Cloudflare Pages 新建项目并连接本仓库时，设置：

- **Build command**: `npm run build`
- **Build output directory**: `dist`

之后每次 `git push` 到 GitHub，Cloudflare Pages 会自动拉取源码 → 安装依赖 → 构建 → 部署 `dist/`。
本地只需要 push 源码（`src/`、`build.js`、`package.json`），无需提交 `dist/`（已 .gitignore 忽略）。

> 修改导航、页脚或按钮只需改 `src/_includes/` 或 `build.js` 里的配置，重新 `npm run build` 即可全站生效。**请勿直接编辑 `dist/` 下的 HTML，它们由构建生成。**

> **图片资源**：页面只引用 `images/` 下的派生版本，`charlie.webp`、`ZhouShenALPHA.webp`、`avatar.webp`、`reward_code*.webp` 作为高清母版保留（不再被页面直接引用）。两张首屏人像都是「单一 AVIF + WebP 回退」的 `<picture>`，并由 `<head>` 里的 `<link rel="preload">` 提前发起。
>
> ⚠️ 改图时注意：
> - `<link rel="preload">` 的地址必须和 `<source>` 的唯一候选**完全一致**，否则浏览器会白下一份。
> - 不要在首屏图上加多个 `srcset` 候选：Chromium 预加载扫描器会先按 1x 猜一张、再按实际 DPR 换一张，等于多下一份。
> - 换母版后要按文件名里的尺寸重新导出对应派生版本（如 `charlie-1101w.avif`、`ZhouShenALPHA-333w.avif`）；`charlie-mask.webp` 是 `charlie.webp` 的 alpha 通道遮罩，也要同步更新。

> **背景线稿**：`images/bg-doodle-a.svg` / `bg-doodle-b.svg` 由 `build.js` 在构建时内联进 `dist/css/main.css`（转 data URI，去掉注释与多余空白）。原因是浏览器对 `mask-image` 只在绘制时才发请求，既不复用 `<link rel=preload>`，也不与隐藏 `<img>` 的请求合并，留成独立文件只会让底纹到 1s 后才冒出来。改完 `.svg` 重新构建即可，无需手工内联；源目录里的 `css/main.css` 保持 `url('/images/bg-doodle-*.svg')` 写法。

> **字体**：全部自托管，页面不再请求 Google Fonts / rsms.me。字体文件在 `css/fonts/`，`@font-face` 由 `tools/build-fonts.py` 生成到 `css/_fonts.generated.css`，构建时注入 `dist/css/main.css`（与主样式同一个请求，浏览器解析到就能开始下载，首屏字体还会被 `<head>` 预加载）。
>
> 字体按站点实际用到的字符做了子集化（约 1000 个字符），**但保留了完整的 OpenType 特性表**（`tnum` 等宽数字、`halt`/`palt` 中文半宽标点、`ss01`、图标字体的 `liga` 连字…）。改字体时不要用 `--layout-features=` 收窄特性，否则这些排版会静默失效。
>
> 内容大改后需要重新生成（需要 Python + `pip install fonttools brotli`；构建本身不需要 Python）：
>
> ```bash
> npm run fonts     # = build(取字符集) → 生成字体 → 再 build(注入 @font-face)
> ```
>
> ⚠️ 顺序很重要：脚本靠扫描 `dist/` 的 HTML 提取字符集，所以必须先把页面构建出来。
>
> **Google Sans Flex 的斜体**：Google Fonts 上架的版本只有 `opsz`/`wdth`/`wght` 三个轴，
> **没有 `slnt`**，所以从 Google Fonts 取不到斜体。脚本改从上游发布版
> （`googlefonts/googlesans-flex` 的 `GoogleSansFlex-v5.000.zip`，版本号与 Google 版一致）
> 取全轴 VF `[ROND,opsz,slnt,wdth,wght]`，再用 `slnt = -10` 实例化出斜体面。
> 因此会产出两个文件：`GoogleSansFlex.woff2`（`slnt=0`）与 `GoogleSansFlex-italic.woff2`。
> 斜体面只在真的用到 `<i>`/`<em>` 的页面加载（站点规定仅 en-US 生效），中文页不会下载。
>
> **斜体默认单层 a**：字体把单层 a 放在 `ss01`（`a → a.alt`，含带变音符的变体）里，而 ss01 默认关闭。
> 脚本在生成斜体面后，把 ss01 引用的 lookup 并入 `ccmp`（所有 shaper 默认应用），
> 所以斜体无需任何 CSS 声明就是单层 a（canvas、导出同样生效）；直立体保持双层不变。
> 已确认该字体中只有 ss01 引用字形 `a`，`calt` 只处理 `:~` 与 `数字:`，因此这一步不会破坏其他特性。
> 注意：子集化后 `ccmp` 可能被整体丢弃，脚本会在缺失时新建并注册到每个 LangSys。
>
> **缺字检查**：`npm run build` 会自动执行 `node tools/check-fonts.js`——它解析各 `.woff2` 的 cmap 表，逐字比对全站文案，**有缺字就报错并列出来源页面**（缺字本身不会报错，只会静默回退到系统字体，所以必须有这道闸门）。Cloudflare Pages 用 `npm run build`，因此新字符漏生成时构建会失败，而不是悄悄上线一个混排的页面。

---
Built with love to you all and Charlie Zhou Shen by Ethan Shaw.