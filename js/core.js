// 图标资源
const ICONS = {
    sun: '<path d="M9.15039 9.15088L11.3778 11.3783" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 24H6.15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.15039 38.8495L11.3778 36.6221" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 38.8495L36.6221 36.6221" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44.9996 24H41.8496" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 9.15088L36.6221 11.3783" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 3V6.15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 36C30.6274 36 36 30.6274 36 24C36 17.3726 30.6274 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 45.0001V41.8501" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    moon: '<path d="M28.0527 4.41085C22.5828 5.83695 18.5455 10.8106 18.5455 16.7273C18.5455 23.7564 24.2436 29.4545 31.2727 29.4545C37.1894 29.4545 42.1631 25.4172 43.5891 19.9473C43.8585 21.256 44 22.6115 44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C25.3885 4 26.744 4.14149 28.0527 4.41085Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>'
};

// 滚动监听
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('top-nav');
    const hero = document.querySelector('.hero-section');
    if (navbar && hero) {
        navbar.classList.toggle('visible', window.scrollY >= hero.offsetHeight - 20);
    }
});

// 抖动效果
function shakeCard(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
}

// 里程碑翻页
function scrollMilestones(direction) {
    const container = document.getElementById('milestoneScrollContainer');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('.milestone-card')).filter(c => c.style.display !== 'none');
    if (cards.length === 0) return;

    const containerWidth = container.offsetWidth;
    const centerLine = container.scrollLeft + containerWidth / 2;

    let minDiff = Infinity;
    let currentIndex = 0;
    cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const diff = Math.abs(centerLine - cardCenter);
        if (diff < minDiff) { minDiff = diff; currentIndex = index; }
    });

    let targetIndex = Math.max(0, Math.min(currentIndex + direction, cards.length - 1));
    const targetCard = cards[targetIndex];
    const targetScrollLeft = targetCard.offsetLeft - (containerWidth / 2) + (targetCard.offsetWidth / 2);
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
}

// 里程碑筛选
function filterMilestones(year, btn) {
    const container = document.getElementById('milestoneScrollContainer');
    const cards = container.querySelectorAll('.milestone-card');
    
    // 切换当前按钮的激活状态
    btn.classList.toggle('active');

    // 获取所有当前选中的年份
    const activeButtons = document.querySelectorAll('.year-filter-btn.active');
    const activeYears = Array.from(activeButtons).map(b => b.textContent.trim());

    cards.forEach(card => {
        const cardYear = card.getAttribute('data-year');
        // 如果没有选中任何年份，则显示全部；否则仅显示匹配选中年份的卡片
        card.style.display = (activeYears.length === 0 || activeYears.includes(cardYear)) ? 'block' : 'none';
    });
    container.scrollLeft = 0;
    updateMilestoneButtons();
}

function updateMilestoneButtons() {
    const container = document.getElementById('milestoneScrollContainer');
    const prevBtn = document.querySelector('.milestone-nav-btn.prev');
    const nextBtn = document.querySelector('.milestone-nav-btn.next');
    if (!container || !prevBtn || !nextBtn) return;

    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.offsetWidth;

    prevBtn.classList.toggle('hidden', scrollLeft <= 5);
    nextBtn.classList.toggle('hidden', scrollLeft >= maxScroll - 5);

    const leftAlpha = Math.min(1, Math.max(0, 1 - (scrollLeft / 60)));
    const rightAlpha = Math.min(1, Math.max(0, 1 - ((maxScroll - scrollLeft) / 60)));
    container.style.setProperty('--mask-left', `rgba(0,0,0,${leftAlpha})`);
    container.style.setProperty('--mask-right', `rgba(0,0,0,${rightAlpha})`);
}

// 亮暗模式切换
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkNow = currentTheme === 'dark' || (!currentTheme && systemDark);

    const newTheme = isDarkNow ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    // 更新图标
    const svgs = document.querySelectorAll('.theme-toggle-btn svg, .nav-theme-toggle svg');
    svgs.forEach(s => s.innerHTML = isDarkNow ? ICONS.sun : ICONS.moon);
    
    // 更新赞赏码（如果存在）
    const qrImg = document.querySelector('.reward-qr');
    const qrSource = document.querySelector('#reward-overlay picture source');
    if (qrImg) qrImg.src = isDarkNow ? "images/reward_code.webp" : "images/reward_code_dark.webp";
    if (qrSource) qrSource.srcset = isDarkNow ? "images/reward_code.webp" : "images/reward_code_dark.webp";
}

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
            if (!document.querySelector('.reward-overlay.active')) {
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
        const msg = isEn ? 'Copied to clipboard' : '已复制群号到剪贴板';
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

    // 初始化里程碑
    const milestoneContainer = document.getElementById('milestoneScrollContainer');
    if (milestoneContainer) {
        milestoneContainer.addEventListener('scroll', updateMilestoneButtons);
        updateMilestoneButtons();
    }

    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.reward-overlay').forEach(el => toggleModal(el.id, false));
    });

    // 初始化图标状态
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.querySelectorAll('.theme-toggle-btn svg, .nav-theme-toggle svg').forEach(s => s.innerHTML = ICONS.moon);
    }
});