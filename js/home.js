// 暂未开通卡片点击晃动效果
function shakeCard(el) {
	el.classList.add('shake');
	setTimeout(() => {
        el.classList.remove('shake');
	}, 400);
}

// 里程碑横向滚动控制 - 实现卡片居中翻页
function scrollMilestones(direction) {
	const container = document.getElementById('milestoneScrollContainer');
	if (!container) return;
	const cards = container.querySelectorAll('.milestone-card');
	if (cards.length === 0) return;

	const containerWidth = container.offsetWidth;
	const centerLine = container.scrollLeft + containerWidth / 2;

	// 寻找当前最靠近中心的卡片索引
	let minDiff = Infinity;
	let currentIndex = 0;
	cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const diff = Math.abs(centerLine - cardCenter);
        if (diff < minDiff) {
            minDiff = diff;
            currentIndex = index;
        }
	});

	let targetIndex = currentIndex + direction;
	targetIndex = Math.max(0, Math.min(targetIndex, cards.length - 1));

	const targetCard = cards[targetIndex];
	// 计算让目标卡片居中的滚动位置
	const targetScrollLeft = targetCard.offsetLeft - (containerWidth / 2) + (targetCard.offsetWidth / 2);
	container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
}

// 里程碑年份筛选
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

// 更新里程碑按钮可见性及遮罩渐变
function updateMilestoneButtons() {
	const container = document.getElementById('milestoneScrollContainer');
	const prevBtn = document.querySelector('.milestone-nav-btn.prev');
	const nextBtn = document.querySelector('.milestone-nav-btn.next');
	if (!container || !prevBtn || !nextBtn) return;

	const scrollLeft = container.scrollLeft;
	const maxScroll = container.scrollWidth - container.offsetWidth;

	// 按钮显示/隐藏逻辑
	prevBtn.classList.toggle('hidden', scrollLeft <= 5);
	nextBtn.classList.toggle('hidden', scrollLeft >= maxScroll - 5);

	// 动态更新遮罩：0px 时 alpha=1 (不透明，遮罩消失)，60px 时 alpha=0 (透明，遮罩全开)
	// 使用 Math.min/max 确保数值在 0-1 之间
	const leftAlpha = Math.min(1, Math.max(0, 1 - (scrollLeft / 60)));
	const rightAlpha = Math.min(1, Math.max(0, 1 - ((maxScroll - scrollLeft) / 60)));

	container.style.setProperty('--mask-left', `rgba(0,0,0,${leftAlpha})`);
	container.style.setProperty('--mask-right', `rgba(0,0,0,${rightAlpha})`);
}
// core.js 中已经包含了通用的 keydown(ESC) 监听，此处无需重复。

document.addEventListener('DOMContentLoaded', () => {
	// core.js 处理了图标状态初始化，此处省略。
	
	// 点击页面外部时收起菜单，且不触发下方元素的交互
	document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('nav-dropdown');
        const toggleBtn = document.querySelector('.menu-toggle');
        if (dropdown.classList.contains('active') && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
            toggleMenu(false);
            e.preventDefault();
            e.stopPropagation();
        }
	}, true); // 使用捕获模式以拦截事件
	
	// 初始化里程碑滚动按钮状态
	const milestoneScrollContainer = document.getElementById('milestoneScrollContainer');
	if (milestoneScrollContainer) {
		milestoneScrollContainer.addEventListener('scroll', updateMilestoneButtons);
		updateMilestoneButtons();
	}
});
