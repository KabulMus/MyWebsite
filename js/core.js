// 1. 主题应用：设置 data-theme（主题按钮图标显隐由 CSS 控制），并同步赞赏码
function applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);

    const isDark = theme === 'dark';

    // 同步更新赞赏码图片（如果页面上有的话）
    const qrImg = document.querySelector('.modal-qr');
    const qrSource = document.querySelector('#modal-overlay picture source');
    if (qrImg) qrImg.src = isDark ? "../images/reward_code_dark.webp" : "../images/reward_code.webp";
    if (qrSource) qrSource.srcset = isDark ? "../images/reward_code_dark.webp" : "../images/reward_code.webp";
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
    applyTheme(newSystemSystemTheme || newSystemTheme);
});

// 7. 页面加载完成后自动触发初始化
document.addEventListener('DOMContentLoaded', initTheme);

// 弹窗控制
function toggleModal(id, show) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    
    if (show) {
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