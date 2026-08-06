/**
 * MyWebsite 静态站构建脚本
 * -------------------------
 * 用法:
 *   node build.js            # 渲染 HTML 到 dist/ 并复制静态资源
 *
 * 说明:
 *   - 页面正文模板位于 src/zh/*.njk 与 src/en/*.njk
 *   - 公共部分(layout/nav/footer/按钮)位于 src/_includes/
 *   - 每页元数据(标题/样式/脚本/导航高亮)集中配置在下方 PAGES
 *   - 构建产物输出到 dist/(HTML + css/js/images/favicon)，供 Cloudflare Pages 等部署。
 */
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

/* ---------------------------- 静态资源复制 ---------------------------- */
const STATIC_DIRS = ['css', 'js', 'images'];
function copyStatic() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const d of STATIC_DIRS) {
    fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
  }
  if (fs.existsSync(path.join(ROOT, 'favicon.webp'))) {
    fs.copyFileSync(path.join(ROOT, 'favicon.webp'), path.join(DIST, 'favicon.webp'));
  }
}

/* -------------------------------- 文案 -------------------------------- */
const I18N = {
  zh: {
    'menu.aria': '菜单',
    'lang.aria': 'Switch to English',
    'theme.aria': '切换亮暗模式',
    'nav.about': '关于我',
    'nav.milestones': '里程碑',
    'nav.explore': '探索',
    'footer.info': '技术与版权',
    main: [
      { key: 'blog', href: 'https://blog.ethan929.com', text: '博客' },
      { key: 'channels', href: 'channels', text: '频道列表' },
      { key: 'toolkit', href: 'toolkit', text: '工具箱' },
      { key: 'support', href: 'support', text: '联系支持' },
      { key: 'charlie', href: 'charlie', text: '关于周深' },
    ],
  },
  en: {
    'menu.aria': 'Menu',
    'lang.aria': '切换为中文',
    'theme.aria': 'Toggle Theme',
    'nav.about': 'About Me',
    'nav.milestones': 'Milestones',
    'nav.explore': 'Explore',
    'footer.info': 'Tech & Copyright',
    main: [
      { key: 'blog', href: 'https://blog.ethan929.com/en-US/', text: 'Blog' },
      { key: 'channels', href: 'channels', text: 'Channels' },
      { key: 'toolkit', href: 'toolkit', text: 'Toolkit' },
      { key: 'support', href: 'support', text: 'Support' },
      { key: 'charlie', href: 'charlie', text: 'About Charlie' },
    ],
  },
};

/* -------------------------------- 图标 -------------------------------- */
const ICONS = {
  back: '<svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24L31 12"/></svg>',
  menu: '<svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M7.94971 11.9497H39.9497"/><path d="M7.94971 23.9497H39.9497"/><path d="M7.94971 35.9497H39.9497"/></svg>',
  globe:
    '<svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M24 44.0002C35.0457 44.0002 44 35.0459 44 24.0002C44 12.9545 35.0457 4.00024 24 4.00024C12.9543 4.00024 4 12.9545 4 24.0002C4 35.0459 12.9543 44.0002 24 44.0002Z" stroke="currentColor" stroke-width="4"/><path d="M6 30.9856C8.63192 32.041 10.5266 32.041 11.6839 30.9856C13.4199 29.4025 11.9219 24.5978 14.3532 23.2727C16.7844 21.9476 20.4886 27.8214 23.9508 25.8887C27.4129 23.9559 23.6246 18.8023 26.0272 16.713C28.4298 14.6237 31.554 16.98 32.1001 13.4865C32.6462 9.99304 29.5521 11.5082 28.9584 8.20693C28.5625 6.00611 28.5625 4.84884 28.9584 4.73511" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M29.0209 43.3505C27.1468 41.4325 26.4721 39.6497 26.9969 38.0019C27.7841 35.5303 29.0826 35.6764 29.6488 34.1482C30.2149 32.6199 28.6156 30.4433 32.1643 28.5826C34.5301 27.3421 37.783 28.7794 41.9228 32.8944" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  theme:
    '<svg viewBox="0 0 48 48">\n\t\t\t<!-- 太阳/月亮组合图标 -->\n\t\t\t<path d="M9.15039 9.15088L11.3778 11.3783" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 24H6.15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.15039 38.8495L11.3778 36.6221" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 38.8495L36.6221 36.6221" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44.9996 24H41.8496" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 9.15088L36.6221 11.3783" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 3V6.15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 36C30.6274 36 36 30.6274 36 24C36 17.3726 30.6274 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 45.0001V41.8501" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n\t\t</svg>',
};

/* ------------------------------ 页面配置 ------------------------------ */
/**
 * 每页配置字段:
 *   key       页面标识(用于语言切换与输出文件名)
 *   titles    中/英文标题 { zh, en }
 *   css       <link> 追加的样式表(不含 main.css)
 *   js        <script> 追加的脚本(不含 core.js)
 *   preload   是否预加载 ZhouShenALPHA.webp
 *   nav       是否渲染导航栏(默认 true)
 *   isHome    是否主页(主页导航/hero 特例)
 *   active    右侧主链接高亮 key(null 表示不高亮)
 *   navLeft   左侧导航链接 { zh: [...], en: [...] }
 *   showLangToggle  是否渲染语言切换按钮(默认 true)
 *   showFooterLink  页脚是否带「技术与版权」链接(默认 true)
 *   inlineHead      <head> 内追加的原始内容(如 404 样式)
 */
const PAGES = {
  index: {
    key: 'index', isHome: true,
    titles: { zh: '个人主页 | Ethan Shaw', en: 'Home | Ethan Shaw' },
    desc: { zh: 'Ethan Shaw 的个人主页——一名热爱音乐的中学生、B 站 up 主，也是一枚深爱周深的「生米」。这里有我的简介、成长里程碑、创作频道与音乐小工具。', en: 'The personal homepage of Ethan Shaw — a music-loving student, Bilibili creator, and a devoted fan of Zhou Shen (Charlie). Explore my story, milestones, channels, and music tools.' },
    css: ['home.css', 'milestone.css'],
    js: ['home.js'],
    preload: true,
    active: null,
  },
  channels: {
    key: 'channels',
    titles: { zh: '频道列表 | Ethan Shaw', en: 'Channels | Ethan Shaw' },
    desc: { zh: 'Ethan Shaw 在哔哩哔哩、YouTube、小红书等平台的频道列表，欢迎来关注我的创作。', en: "Ethan Shaw's channels on Bilibili, YouTube, Xiaohongshu, and more — come follow my creations." },
    css: ['channels.css'],
    js: ['home.js'],
    active: 'channels',
    navLeft: {
      zh: [
        { href: '#bilibili', text: '哔哩哔哩' },
        { href: '#rednote', text: '小红书' },
        { href: '#youtube', text: 'YouTube' },
      ],
      en: [
        { href: '#bilibili', text: 'Bilibili' },
        { href: '#rednote', text: 'Rednote' },
        { href: '#youtube', text: 'YouTube' },
      ],
    },
  },
  charlie: {
    key: 'charlie',
    titles: { zh: '关于周深 | Ethan Shaw', en: 'About Charlie | Ethan Shaw' },
    desc: { zh: '关于歌手周深的介绍、音乐作品与工作室信息——来自一枚「生米」的深深热爱。', en: 'An introduction to singer Charlie Zhou Shen, his music, and his studio — with deep love from a devoted fan.' },
    css: ['charlie.css', 'milestone.css'],
    js: ['home.js'],
    preload: true,
    active: 'charlie',
    navLeft: {
      zh: [
        { href: '#intro', text: '介绍' },
        { href: '#charlie', text: '追踪周深' },
        { href: '#studio', text: '工作室' },
        { href: '#music', text: '「深」声不息' },
      ],
      en: [
        { href: '#intro', text: 'Introduction' },
        { href: '#charlie', text: 'Follow Charlie' },
        { href: '#studio', text: 'Studio' },
        { href: '#music', text: 'Echoes' },
      ],
    },
  },
  detector: {
    key: 'detector',
    titles: { zh: '音频分析仪 | Ethan Shaw', en: 'Audio Analyzer | Ethan Shaw' },
    desc: { zh: '使用麦克风实时测量声音频率与音高的音频分析仪，适用于乐器调音、练耳与音高训练。', en: 'A real-time audio analyzer that measures sound frequency and pitch via your microphone — ideal for tuning, ear training, and pitch practice.' },
    css: ['detector.css', 'pages.css', 'notationbtn.css'],
    js: ['detector.js'],
    active: 'detector',
    navLeft: {
      zh: [
        { href: 'scales', text: '音阶构成' },
        { href: '#', text: '音频分析仪', active: true },
        { href: 'piano', text: '在线钢琴' },
      ],
      en: [
        { href: 'scales', text: 'Scale Visualizer' },
        { href: '#', text: 'Audio Analyzer', active: true },
        { href: 'piano', text: 'Online Piano' },
      ],
    },
  },
  info: {
    key: 'info',
    titles: { zh: '技术与版权 | Ethan Shaw', en: 'Tech & Copyright | Ethan Shaw' },
    desc: { zh: '本站背后的技术支持与版权归属：开源仓库、托管服务、图标字体、字体与协议说明。', en: 'The technology and copyright behind this site: source repository, hosting, icon fonts, typefaces, and licenses.' },
    css: ['pages.css'],
    js: ['home.js'],
    active: null,
    showFooterLink: false,
    noindex: true,
    navLeft: {
      zh: [
        { href: '#tech', text: '技术支持' },
        { href: '#copyright', text: '版权归属' },
      ],
      en: [
        { href: '#tech', text: 'Technical Credits' },
        { href: '#copyright', text: 'Copyright Notice' },
      ],
    },
  },
  piano: {
    key: 'piano',
    titles: { zh: '在线钢琴 | Ethan Shaw', en: 'Online Piano | Ethan Shaw' },
    desc: { zh: '在线钢琴：显示音名、黑键标注、移调与全键盘模式，可直接用电脑键盘弹奏。', en: 'An online piano with note labels, notation options, transpose, and full-keyboard mode — playable with your computer keyboard.' },
    css: ['piano.css'],
    js: ['soundfont-player.js', 'piano.js'],
    active: 'piano',
    navLeft: {
      zh: [
        { href: 'scales', text: '音阶构成' },
        { href: 'detector', text: '音频分析仪' },
        { href: '#', text: '在线钢琴', active: true },
      ],
      en: [
        { href: 'scales', text: 'Scale Visualizer' },
        { href: 'detector', text: 'Audio Analyzer' },
        { href: '#', text: 'Online Piano', active: true },
      ],
    },
  },
  scales: {
    key: 'scales',
    titles: { zh: '音阶构成 | Ethan Shaw', en: 'Musical Scale Composition | Ethan Shaw' },
    desc: { zh: '直观展示 12 个自然大调的音阶构成及其关系小调，支持升号降号与根音选择。', en: 'Visualize the 12 major scales and their relative minors, with sharp/flat and root-note switching.' },
    css: ['scales.css', 'notationbtn.css'],
    js: ['scales.js'],
    active: 'scales',
    navLeft: {
      zh: [
        { href: '#', text: '音阶构成', active: true },
        { href: 'detector', text: '音频分析仪' },
        { href: 'piano', text: '在线钢琴' },
      ],
      en: [
        { href: '#', text: 'Scale Visualizer', active: true },
        { href: 'detector', text: 'Audio Analyzer' },
        { href: 'piano', text: 'Online Piano' },
      ],
    },
  },
  support: {
    key: 'support',
    titles: { zh: '联系支持 | Ethan Shaw', en: 'Support | Ethan Shaw' },
    desc: { zh: '联系 Ethan Shaw：加入交流群、反馈问题或通过邮箱与我取得联系。', en: 'Get in touch with Ethan Shaw: join the community, report issues, or reach me by email.' },
    css: ['pages.css'],
    js: ['home.js'],
    active: 'support',
    navLeft: {
      zh: [
        { href: '#email', text: '个人邮箱' },
        { href: '#qq', text: 'QQ 群' },
        { href: '#discord', text: 'Discord' },
        { href: '#github', text: 'GitHub' },
        { href: '#reward', text: '赞赏码' },
        { href: '#duolingo', text: '多邻国' },
      ],
      en: [
        { href: '#email', text: 'Email' },
        { href: '#qq', text: 'QQ Group' },
        { href: '#discord', text: 'Discord' },
        { href: '#github', text: 'GitHub' },
        { href: '#reward', text: 'Reward' },
        { href: '#duolingo', text: 'Duolingo' },
      ],
    },
  },
  toolkit: {
    key: 'toolkit',
    titles: { zh: '工具箱 | Ethan Shaw', en: 'Toolkit | Ethan Shaw' },
    desc: { zh: 'Ethan Shaw 的音乐工具箱：在线钢琴、音阶构成、音频分析仪等实用小工具。', en: "Ethan's music toolkit: online piano, scale visualizer, audio analyzer, and more handy tools." },
    css: ['pages.css', 'toolkit.css'],
    js: [],
    active: 'toolkit',
    navLeft: {
      zh: [
        { href: '#scales', text: '音阶构成' },
        { href: '#detector', text: '音频分析仪' },
        { href: '#piano', text: '在线钢琴' },
      ],
      en: [
        { href: '#scales', text: 'Scale Visualizer' },
        { href: '#detector', text: 'Audio Analyzer' },
        { href: '#piano', text: 'Online Piano' },
      ],
    },
  },
  notfound: {
    key: 'notfound',
    titles: { zh: '404 - Page Not Found | Ethan Shaw', en: '404 - Page Not Found | Ethan Shaw' },
    css: [],
    js: [],
    nav: false,
    showLangToggle: false,
    showFooterLink: false,
    inlineHead: '<style>\n' +
      '\t\t/* 404 页面专用样式 */\n' +
      '\t\t.content-section { padding: 120px 20px 60px; text-align: left; min-height: 80vh; display: flex; align-items: center; justify-content: center; }\n' +
      '\t\t.error-title {\n' +
      '\t\t\tfont-size: clamp(5rem, 15vw, 8rem); font-weight: 900; line-height: 1.1; margin-bottom: 20px;\n' +
      '\t\t\tbackground: linear-gradient(135deg, var(--primary-blue) 0%, #0b122a 60%); \n' +
      '\t\t\t-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;\n' +
      '\t\t}\n' +
      '\t\t[data-theme=\'dark\'] .error-title { background: linear-gradient(90deg, #ffffff 0%, var(--primary-blue) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }\n' +
      '\t\t@media (prefers-color-scheme: dark) {\n' +
      '\t\t\t:root:not([data-theme=\'light\']) .error-title {\n' +
      '\t\t\t\tbackground: linear-gradient(135deg, #ffffff 0%, var(--primary-blue) 60%);\n' +
      '\t\t\t\t-webkit-background-clip: text;\n' +
      '\t\t\t\tbackground-clip: text; /* 标准属性，提升兼容性 */\n' +
      '\t\t\t\t-webkit-text-fill-color: transparent;\n' +
      '\t\t\t}\n' +
      '\t\t}\n' +
      '\t\t.error-tagline { font-size: 1.2rem; font-weight: 500; margin-bottom: 15px; }\n' +
      '\t\t.section-content { margin-bottom: 70px; }\n' +
      '\t\t.about-text p { max-width: 600px; margin: 0 auto; color: var(--text-sub); }\n' +
      '\n' +
      '\t\t/* 移动端自动去掉换行：将段落设为行内显示 */\n' +
      '\t\t@media (max-width: 768px) {\n' +
      '\t\t\t.section-content p { display: inline; margin: 0; }\n' +
      '\t\t\t/* 缩小不同区块间的间距，若想完全合并可以将 div 也设为 inline */\n' +
      '\t\t\t.section-content div { margin-bottom: 10px !important; }\n' +
      '\t\t\t.modal-btn { display: block; margin-top: 25px; width: fit-content; }\n' +
      '\t\t}\n' +
      '\t</style>',
  },
};

/* ---------------------------- 渲染环境与全局 ---------------------------- */
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(SRC), {
  autoescape: true,
  trimBlocks: true,
  lstripBlocks: true,
});

env.addGlobal('ICONS', ICONS);
// 文案取值: {{ t('key', page.lang) }}
env.addGlobal('t', (key, lang) => I18N[lang || 'zh'][key]);
// 语言切换链接: {{ langHref(page) }}
env.addGlobal('langHref', (page) => {
  if (page.isHome) return page.lang === 'en' ? '../' : 'en-US';
  return page.lang === 'en' ? '../' + page.key : '../en-US/' + page.key;
});

/* -------------------------------- 构建 -------------------------------- */
const TEMPLATES = {
  zh: [
    { tpl: 'zh/index.njk', out: 'index.html', page: PAGES.index },
    { tpl: 'zh/channels.njk', out: 'channels.html', page: PAGES.channels },
    { tpl: 'zh/charlie.njk', out: 'charlie.html', page: PAGES.charlie },
    { tpl: 'zh/detector.njk', out: 'detector.html', page: PAGES.detector },
    { tpl: 'zh/info.njk', out: 'info.html', page: PAGES.info },
    { tpl: 'zh/piano.njk', out: 'piano.html', page: PAGES.piano },
    { tpl: 'zh/scales.njk', out: 'scales.html', page: PAGES.scales },
    { tpl: 'zh/support.njk', out: 'support.html', page: PAGES.support },
    { tpl: 'zh/toolkit.njk', out: 'toolkit.html', page: PAGES.toolkit },
    { tpl: 'zh/404.njk', out: '404.html', page: PAGES.notfound },
  ],
  en: [
    { tpl: 'en/index.njk', out: 'en-US/index.html', page: PAGES.index },
    { tpl: 'en/channels.njk', out: 'en-US/channels.html', page: PAGES.channels },
    { tpl: 'en/charlie.njk', out: 'en-US/charlie.html', page: PAGES.charlie },
    { tpl: 'en/detector.njk', out: 'en-US/detector.html', page: PAGES.detector },
    { tpl: 'en/info.njk', out: 'en-US/info.html', page: PAGES.info },
    { tpl: 'en/piano.njk', out: 'en-US/piano.html', page: PAGES.piano },
    { tpl: 'en/scales.njk', out: 'en-US/scales.html', page: PAGES.scales },
    { tpl: 'en/support.njk', out: 'en-US/support.html', page: PAGES.support },
    { tpl: 'en/toolkit.njk', out: 'en-US/toolkit.html', page: PAGES.toolkit },
  ],
};

/* ---------------------------- SEO: Sitemap / Robots ---------------------------- */
const SITE_URL = 'https://www.ethan929.com';

// 页 key → 该页路径（中文在根，英文在 /en-US 下）
function pageUrl(key, lang) {
  const root = lang === 'zh' ? '' : '/en-US';
  return key === 'index' ? (root || '/') : root + '/' + key;
}

function generateSitemap() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const keys = new Set();
  for (const lang of ['zh', 'en']) {
    for (const { page } of TEMPLATES[lang]) {
      if (page.key !== 'notfound' && !page.noindex) keys.add(page.key);
    }
  }
  const urls = [];
  for (const key of keys) {
    const zh = SITE_URL + pageUrl(key, 'zh');
    const en = SITE_URL + pageUrl(key, 'en');
    for (const [lang, loc] of [['zh-CN', zh], ['en-US', en]]) {
      urls.push(
        '  <url>\n' +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}"/>\n` +
        `    <xhtml:link rel="alternate" hreflang="en-US" href="${en}"/>\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/"/>\n` +
        '  </url>'
      );
    }
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.join('\n') + '\n' +
    '</urlset>\n';
  const out = path.join(DIST, 'sitemap.xml');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, xml, 'utf8');
  console.log('✓ sitemap.xml (' + keys.size * 2 + ' 个 URL)');
}

function generateRobots() {
  const out = path.join(DIST, 'robots.txt');
  fs.writeFileSync(out,
    'User-agent: *\n' +
    'Allow: /\n\n' +
    `Sitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');
  console.log('✓ robots.txt');
}

function build() {
  copyStatic();
  for (const lang of ['zh', 'en']) {
    for (const { tpl, out, page } of TEMPLATES[lang]) {
      const ctx = {
        page: Object.assign({}, page, {
          lang,
          htmlLang: lang === 'zh' ? 'zh-CN' : 'en-US',
          title: page.titles[lang],
          description: page.desc ? page.desc[lang] : null,
          url: SITE_URL + pageUrl(page.key, lang),
          navLeft: page.navLeft ? page.navLeft[lang] : null,
        }),
      };
      const html = env.render(tpl, ctx);
      const outPath = path.join(DIST, out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log('✓', out);
    }
  }
  generateSitemap();
  generateRobots();
  console.log('\n构建完成 →', DIST);
}

build();
