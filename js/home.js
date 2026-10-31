let activeMilestoneTransition = null;
let activeMilestoneDecades = new Set();
let activeMilestoneYears = new Set();
const MILESTONE_TRANSITION_DURATION = 360;
const MILESTONE_TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const MILESTONE_GROUP_DURATION = 300;
const MILESTONE_GROUP_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const MILESTONE_DECADE_SUFFIX = 's';

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

// 按卡片年份生成年代 / 年份两级筛选器
function initMilestoneFilters() {
	const controls = document.getElementById('milestoneFilters');
	const container = document.getElementById('milestoneScrollContainer');
	if (!controls || !container) return;

	const years = [...new Set([...container.querySelectorAll('.milestone-card')]
		.map(card => card.dataset.year)
		.filter(year => /^\d{4}$/.test(year)))].sort((a, b) => Number(a) - Number(b));
	const decadeYearMap = new Map();
	for (const year of years) {
		const decade = Math.floor(Number(year) / 10) * 10;
		if (!decadeYearMap.has(decade)) decadeYearMap.set(decade, []);
		decadeYearMap.get(decade).push(year);
	}
	const decades = [...decadeYearMap.keys()];
	// 只含一个年份的年代直接显示该年份，不再展开二级筛选
	const singleYearDecades = decades.filter(decade => decadeYearMap.get(decade).length === 1);
	const isEnglish = document.documentElement.lang.startsWith('en');

	const decadeFilters = document.createElement('div');
	decadeFilters.className = 'milestone-decade-filters';
	const yearBar = document.createElement('div');
	yearBar.id = 'milestoneYearBar';
	yearBar.className = 'milestone-year-bar';
	yearBar.setAttribute('aria-hidden', 'true');
	yearBar.inert = true;
	const yearBarInner = document.createElement('div');
	yearBarInner.className = 'milestone-year-bar-inner';
	yearBar.appendChild(yearBarInner);
	yearBar.addEventListener('animationend', event => {
		if (event.target !== yearBar || event.animationName !== 'milestoneYearBarClose') return;
		yearBar.classList.remove('is-closing');
		yearBarInner.replaceChildren();
	});

	activeMilestoneDecades = new Set();
	activeMilestoneYears = new Set();

	for (const decade of decades) {
		const decadeYears = decadeYearMap.get(decade);
		const isSingleYear = decadeYears.length === 1;
		const decadeLabel = `${decade}${MILESTONE_DECADE_SUFFIX}`;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'milestone-filter-btn milestone-decade-btn';
		button.dataset.filterType = 'decade';
		button.dataset.filterValue = String(decade);
		button.setAttribute('aria-pressed', 'false');
		button.setAttribute('aria-expanded', 'false');
		button.setAttribute('aria-controls', yearBar.id);

		if (isSingleYear) {
			const year = decadeYears[0];
			button.dataset.singleYear = '1';
			button.setAttribute('aria-label', isEnglish ? `Filter milestones from ${year}` : `筛选 ${year} 年的里程碑`);
			button.replaceChildren(document.createTextNode(year));
		} else {
			button.setAttribute('aria-label', isEnglish ? `Filter the ${decadeLabel}` : `筛选 ${decadeLabel}`);
			const number = document.createElement('span');
			number.textContent = String(decade);
			const unit = document.createElement('span');
			unit.className = 'milestone-decade-unit';
			unit.textContent = MILESTONE_DECADE_SUFFIX;
			button.replaceChildren(number, unit);
		}

		button.addEventListener('click', () => filterMilestones('decade', String(decade)));
		decadeFilters.appendChild(button);
	}

	controls.replaceChildren(decadeFilters, yearBar);
	controls.dataset.years = years.join(',');
	controls.dataset.decades = decades.join(',');
	controls.dataset.singleDecades = singleYearDecades.join(',');
}

// 同一个年代组只更新状态，新增/移除年代时才增删对应的年份组
function updateMilestoneYearBar(controls, isEnglish) {
	const yearBar = controls.querySelector('.milestone-year-bar');
	const inner = yearBar.querySelector('.milestone-year-bar-inner');
	const years = controls.dataset.years ? controls.dataset.years.split(',') : [];
	const singleYearDecades = new Set((controls.dataset.singleDecades || '')
		.split(',').filter(Boolean).map(Number));
	// 仅含一个年份的年代不展开二级筛选，直接用自身按钮筛选
	const decades = [...activeMilestoneDecades]
		.filter(decade => !singleYearDecades.has(decade))
		.sort((a, b) => a - b);
	const wasOpen = yearBar.classList.contains('is-open');
	const isOpen = decades.length > 0;

	for (const button of controls.querySelectorAll('.milestone-decade-btn')) {
		const decade = Number(button.dataset.filterValue);
		const active = activeMilestoneDecades.has(decade);
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', String(active));
		button.setAttribute('aria-expanded', String(active && !singleYearDecades.has(decade)));
	}

	if (!isOpen) {
		yearBar.inert = true;
		yearBar.setAttribute('aria-hidden', 'true');
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			yearBar.classList.remove('is-open', 'is-closing');
			inner.replaceChildren();
		} else if (wasOpen) {
			yearBar.classList.remove('is-open');
			yearBar.classList.add('is-closing');
		}
		return;
	}

	yearBar.inert = false;
	yearBar.setAttribute('aria-hidden', 'false');
	yearBar.classList.remove('is-closing');

	const groups = new Map([...inner.querySelectorAll('.milestone-year-group-shell')]
		.map(shell => [Number(shell.dataset.decade), shell]));
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const gap = parseFloat(getComputedStyle(inner).rowGap) || 0;
	const timing = { duration: MILESTONE_GROUP_DURATION, easing: MILESTONE_GROUP_EASING, fill: 'both' };

	for (const [decade, shell] of groups) {
		if (decades.includes(decade)) continue;
		groups.delete(decade);
		if (reduceMotion) {
			shell.remove();
			continue;
		}
		const height = shell.offsetHeight;
		shell.animate([
			{ height: `${height}px`, marginBottom: '0px', opacity: 1 },
			{ height: '0px', marginBottom: `${-gap}px`, opacity: 0 },
		], timing).finished.catch(() => {}).then(() => shell.remove());
	}

	for (const decade of decades) {
		const isNew = !groups.has(decade);
		let shell = groups.get(decade);
		if (isNew) {
			shell = document.createElement('div');
			shell.className = 'milestone-year-group-shell';
			shell.dataset.decade = String(decade);

			const group = document.createElement('div');
			group.className = 'milestone-year-group';
			group.setAttribute('role', 'group');
			group.setAttribute('aria-label', isEnglish
				? `Years in the ${decade}${MILESTONE_DECADE_SUFFIX}`
				: `${decade}${MILESTONE_DECADE_SUFFIX} 内的年份`);

			for (const year of years.filter(value => Math.floor(Number(value) / 10) * 10 === decade)) {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'milestone-filter-btn milestone-year-btn';
				button.textContent = year;
				button.dataset.filterType = 'year';
				button.dataset.filterValue = year;
				button.setAttribute('aria-label', isEnglish ? `Filter milestones from ${year}` : `筛选 ${year} 年的里程碑`);
				button.addEventListener('click', () => filterMilestones('year', year));
				group.appendChild(button);
			}
			shell.appendChild(group);
			groups.set(decade, shell);
		}

		if (shell.parentElement !== inner) {
			const next = [...inner.children].find(child => Number(child.dataset.decade) > decade);
			inner.insertBefore(shell, next || null);
		}

		if (isNew && wasOpen && !reduceMotion) {
			const height = shell.offsetHeight;
			const animation = shell.animate([
				{ height: '0px', marginBottom: `${-gap}px`, opacity: 0 },
				{ height: `${height}px`, marginBottom: '0px', opacity: 1 },
			], timing);
			animation.finished.catch(() => {}).then(() => animation.cancel());
		}

		for (const button of shell.querySelectorAll('.milestone-year-btn')) {
			const active = activeMilestoneYears.has(button.dataset.filterValue);
			button.classList.toggle('active', active);
			button.setAttribute('aria-pressed', String(active));
		}
	}

	if (!wasOpen) yearBar.classList.add('is-open');
}

// 里程碑年代 / 年份筛选
function filterMilestones(type, value) {
	const container = document.getElementById('milestoneScrollContainer');
	const controls = document.getElementById('milestoneFilters');
	if (!container || !controls) return;
	const cards = container.querySelectorAll('.milestone-card');
	const transitionContainer = container.parentElement;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (activeMilestoneTransition) {
		activeMilestoneTransition.animations.forEach(animation => animation.cancel());
		activeMilestoneTransition.overlay.remove();
		activeMilestoneTransition = null;
	}

	const isRemovingFilter = type === 'decade'
		? activeMilestoneDecades.has(Number(value))
		: activeMilestoneYears.has(value);
	if (type === 'decade') {
		const decade = Number(value);
		if (isRemovingFilter) {
			activeMilestoneDecades.delete(decade);
			activeMilestoneYears = new Set([...activeMilestoneYears]
				.filter(year => Math.floor(Number(year) / 10) * 10 !== decade));
		} else {
			activeMilestoneDecades.add(decade);
		}
	} else if (type === 'year') {
		if (isRemovingFilter) {
			activeMilestoneYears.delete(value);
		} else {
			activeMilestoneYears.add(value);
		}
	}

	// 年份属于年代：选中具体年份时年代保持选中，只在该年代内收窄
	const hasFilters = activeMilestoneDecades.size > 0;
	updateMilestoneYearBar(controls, document.documentElement.lang.startsWith('en'));

	const shouldShow = [...cards].map(card => {
		const year = card.dataset.year;
		if (!hasFilters) return true;
		if (!/^\d{4}$/.test(year)) return false;
		const decade = Math.floor(Number(year) / 10) * 10;
		if (!activeMilestoneDecades.has(decade)) return false;
		const yearsInDecade = [...activeMilestoneYears]
			.filter(value => Math.floor(Number(value) / 10) * 10 === decade);
		return yearsInDecade.length === 0 || yearsInDecade.includes(year);
	});
	if (shouldShow.every((show, index) => show === (cards[index].style.display !== 'none'))) return;

	const oldHeight = transitionContainer.offsetHeight;
	let outgoing = null;
	if (!reduceMotion) {
		outgoing = container.cloneNode(true);
		outgoing.removeAttribute('id');
		outgoing.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
		outgoing.querySelectorAll('.appearing, .disappearing').forEach(element => {
			element.classList.remove('appearing', 'disappearing');
			element.style.removeProperty('--milestone-animation-delay');
		});
		outgoing.setAttribute('aria-hidden', 'true');
		outgoing.inert = true;
		outgoing.classList.add('milestone-transition-overlay');
		outgoing.style.left = `${container.offsetLeft}px`;
		outgoing.style.top = `${container.offsetTop}px`;
		outgoing.style.width = `${container.offsetWidth}px`;
		outgoing.style.height = `${container.offsetHeight}px`;
		outgoing.scrollLeft = container.scrollLeft;
		transitionContainer.appendChild(outgoing);
	}

	cards.forEach((card, index) => {
		card.classList.remove('appearing', 'disappearing');
		card.style.display = shouldShow[index] ? 'block' : 'none';
	});
	container.scrollLeft = 0;

	if (outgoing) {
		const newHeight = transitionContainer.offsetHeight;
		const direction = isRemovingFilter ? 1 : -1;
		const offset = direction * 12;
		const timing = {
			duration: MILESTONE_TRANSITION_DURATION,
			easing: MILESTONE_TRANSITION_EASING,
			fill: 'both',
		};
		const animations = [
			outgoing.animate(
				[{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${offset}px)` }],
				timing,
			),
			container.animate(
				[{ opacity: 0, transform: `translateY(${-offset}px)` }, { opacity: 1, transform: 'translateY(0)' }],
				timing,
			),
		];
		if (oldHeight !== newHeight) {
			animations.push(transitionContainer.animate(
				[{ height: `${oldHeight}px` }, { height: `${newHeight}px` }],
				timing,
			));
		}

		const transition = { animations, overlay: outgoing };
		activeMilestoneTransition = transition;
		Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
			if (activeMilestoneTransition !== transition) return;
			outgoing.remove();
			animations.forEach(animation => animation.cancel());
			activeMilestoneTransition = null;
		});
	}

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
		initMilestoneFilters();
		milestoneScrollContainer.addEventListener('scroll', updateMilestoneButtons);
		updateMilestoneButtons();
	}

	// 纪念日天数计数器：自 2020.05.20 起，喜欢周深的天数
	const daysCounter = document.getElementById('days-since-zs');
	if (daysCounter) {
		const startDate = new Date(2020, 4, 20); // 2020-05-20（月从 0 起）
		const today = new Date();
		const days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
		daysCounter.textContent = days.toLocaleString();
	}
});

// 页面滚动逻辑
window.addEventListener('scroll', () => {
	const navbar = document.getElementById('top-nav');
	const hero = document.querySelector('.hero-section');
	if (navbar && hero) {
        if (window.scrollY >= hero.offsetHeight - 20) {
            navbar.classList.add('visible');
        } else {
            navbar.classList.remove('visible');
        }
        navbar.classList.toggle('visible', window.scrollY >= hero.offsetHeight - 20);
	}
});
