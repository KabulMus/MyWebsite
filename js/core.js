// 1. 主题应用：设置 data-theme（主题按钮图标显隐由 CSS 控制），并同步赞赏码
function applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);

    // 赞赏码要等弹窗打开才加载，所以这里只在它已经加载过的时候跟随主题切换
    const qrImg = document.querySelector('.modal-qr');
    if (qrImg && qrImg.hasAttribute('src')) syncQrImage();
}

// 按当前主题给赞赏码取址（首次调用发生在弹窗打开时）
function syncQrImage() {
    const img = document.querySelector('.modal-qr');
    if (!img) return;
    const wanted = document.documentElement.getAttribute('data-theme') === 'dark'
        ? img.dataset.srcDark
        : img.dataset.srcLight;
    if (wanted && img.getAttribute('src') !== wanted) img.setAttribute('src', wanted);
}

// 3. 获取当前系统的深浅状态
function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 4. 初始化主题：读取 sessionStorage（关浏览器自动失效）
function initTheme() {
    const savedTheme = sessionStorage.getItem('user-theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // 重启浏览器或新打开页面时，必然走这里——完全跟随系统！
        applyTheme(getSystemTheme());
    }
}

// 5. 按钮点击事件：手动切换，仅存入 sessionStorage
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    sessionStorage.setItem('user-theme', newTheme);
}

// 6. 监听系统主题变化：立刻跟随系统，并清除本次会话的手动设定
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const newSystemTheme = e.matches ? 'dark' : 'light';
    sessionStorage.removeItem('user-theme'); // 清除本次会话的手动记录
    applyTheme(newSystemTheme);
});

// 7. 页面加载完成后自动触发初始化
document.addEventListener('DOMContentLoaded', initTheme);

// 弹窗控制
function toggleModal(id, show) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    
    if (show) {
        syncQrImage();
        document.body.style.overflow = 'hidden';
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
        setTimeout(() => {
            // 只有当没有激活的弹窗时才恢复滚动
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.style.overflow = '';
            }
        }, 300);
    }
}

// 移动端菜单
function toggleMenu(show) {
    const dropdown = document.getElementById('nav-dropdown');
    const toggleBtn = document.querySelector('.menu-toggle');
    const shouldShow = show === undefined ? !dropdown.classList.contains('active') : show;
    dropdown.classList.toggle('active', shouldShow);
    if (toggleBtn) toggleBtn.classList.toggle('active', shouldShow);
}

// 全局 Toast 通知函数
function showToast(message, isError = false) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    const icon = toast.querySelector('svg');
    const text = toast.querySelector('span');
    
    text.innerText = message;
    if (isError) {
        toast.style.borderColor = "#ef4444";
        icon.innerHTML = '<path d="M18 6L6 18M6 6l12 12" style="stroke: #ef4444"/>';
    } else {
        toast.style.borderColor = "var(--primary-blue)";
        icon.innerHTML = '<path d="M20 6L9 17l-5-5" style="stroke: var(--primary-blue)"/>';
    }
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// 复制功能
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const isEn = document.documentElement.lang === 'en-US';
        const msg = isEn ? 'Copied to clipboard' : '已复制到剪贴板';
        showToast(msg);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Copy failed', true);
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 点击外部收起菜单
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('nav-dropdown');
        const toggleBtn = document.querySelector('.menu-toggle');
        if (dropdown?.classList.contains('active') && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
            toggleMenu(false);
        }
    }, true);

    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(el => toggleModal(el.id, false));
    });
});

// 背景图案视差：这一层是 fixed 的，所以「滑动」其实是改 mask 的纵向偏移。
// 偏移量按两块 tile 各自的高度取模（1360 / 920），取多大都接得上。
var DOODLE_RATE = 0.35;
var DOODLE_TILES = [1360, 920];
function shiftDoodles() {
    var body = document.body;
    if (!body) return;
    var y = (window.scrollY || window.pageYOffset || 0) * DOODLE_RATE;
    body.style.setProperty('--bg-shift-a', (-(y % DOODLE_TILES[0])).toFixed(2) + 'px');
    body.style.setProperty('--bg-shift-b', (-(y % DOODLE_TILES[1])).toFixed(2) + 'px');
}
// 不套 rAF：蹭上惯性滚动那类场景 rAF 会被暂停，图案会卡住不动
window.addEventListener('scroll', shiftDoodles, { passive: true });
shiftDoodles();

// 页脚「Charlie」连点三下的彩蛋：显示区域中央弹一颗米子星，三秒后收
function initCharlieEgg() {
    var footer = document.querySelector('footer');
    if (!footer) return;
    var walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
    var node = null;
    while ((node = walker.nextNode())) {
        if (node.nodeValue.indexOf('Charlie') >= 0) break;
    }
    if (!node) return;
    var at = node.nodeValue.indexOf('Charlie');
    node.splitText(at + 7);
    var mid = node.splitText(at);
    var word = document.createElement('span');
    word.className = 'charlie-word';
    word.textContent = 'Charlie';
    mid.parentNode.replaceChild(word, mid);

    var star = document.createElement('div');
    star.className = 'charlie-star';
    star.setAttribute('aria-hidden', 'true');
    // 米子星原坐标只占 0..24，viewBox 就按这个盒子留一点余量；填充用蓝紫渐变（颜色见 CSS）
    star.innerHTML = '<svg viewBox="-1 -1 26 26" fill="url(#charlieStarGrad)">'
        + '<defs><linearGradient id="charlieStarGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs>'
        + '<path d="M23.69,11.56l-6.44-2.24,1.05-3.39c.04-.14-.09-.28-.23-.23l-3.39,1.05L12.44.31c-.14-.41-.73-.41-.87,0l-2.24,6.44-3.39-1.05c-.14-.04-.28.09-.23.23l1.05,3.39L.31,11.56c-.41.14-.41.73,0,.87l6.44,2.24-1.05,3.39c-.04.14.09.28.23.23l3.39-1.05,2.24,6.44c.14.41.73.41.87,0l2.24-6.44,3.39,1.05c.14.04.28-.09.23-.23l-1.05-3.39,6.44-2.24c.41-.14.41-.73,0-.87Z"/></svg>';
    document.body.appendChild(star);

    var hits = 0, lastHit = 0;
    word.addEventListener('click', function () {
        var now = Date.now();
        hits = now - lastHit > 1500 ? 1 : hits + 1;
        lastHit = now;
        if (hits < 3) return;
        hits = 0;
        star.classList.remove('is-on');
        void star.offsetWidth;   // 强制一次重排，让动画能重新播
        star.classList.add('is-on');
    });
    // 动画播完自己收场（出入场都在那条 keyframes 里，所以不用计时器）
    star.addEventListener('animationend', function () {
        star.classList.remove('is-on');
    });
}
document.addEventListener('DOMContentLoaded', initCharlieEgg);