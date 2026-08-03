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
npm run build   # 渲染全部页面到站点根目录（覆盖根目录与 en-US/ 下的 .html）
npm run deploy  # 上传站点根目录到线上（host.retiehe.com）
```

> 以后修改导航、页脚或按钮只需改 `src/_includes/` 或 `build.js` 里的配置，重新 `npm run build` 即可全站生效。**请勿直接编辑根目录 / `en-US/` 下的 HTML，它们由构建生成。**

---
Built with love to you all and Charlie Zhou Shen by Ethan Shaw.