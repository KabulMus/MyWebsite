// 符号切换逻辑
let currentNotation = 'flat';
const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const sharpKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CARD_ENTER_DURATION = 320;
const CARD_EXIT_DURATION = 200;
const CARD_ANIM_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const CARD_ANIM_OFFSET = 10;
let scalesFilterBusy = false;

// 动画结束回调：标签页隐藏等情况下 finished 可能迟迟不 resolve，用定时器兜底
function whenAnimationSettles(animation, duration) {
    const timeout = new Promise(resolve => setTimeout(resolve, duration + 60));
    return Promise.race([animation.finished.catch(() => {}), timeout]);
}

function visibleScaleCards() {
    return [...document.querySelectorAll('.scale-card')].filter(card => card.style.display !== 'none');
}

// 入场从下方升起，退场继续向上离开，两者共用同一缓动与位移量
function animateScaleCards(cards, direction) {
    const entering = direction === 'in';
    return cards.map(card => card.animate(
        entering
            ? [
                { opacity: 0, transform: `translateY(${CARD_ANIM_OFFSET}px) scale(0.95)` },
                { opacity: 1, transform: 'translateY(0) scale(1)' },
            ]
            : [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: `translateY(${-CARD_ANIM_OFFSET}px) scale(0.95)` },
            ],
        {
            duration: entering ? CARD_ENTER_DURATION : CARD_EXIT_DURATION,
            easing: CARD_ANIM_EASING,
            fill: entering ? 'none' : 'forwards',
        },
    ));
}

function updateGridNotation(type) {
    const cards = document.querySelectorAll('.scale-card');
    cards.forEach(c => {
        const name = c.querySelector('.scale-name').textContent.trim();
        const shouldHide = (type === 'flat' && (name.startsWith('C# ') || name.startsWith('D# ') || name.startsWith('F# ') || name.startsWith('G# ') || name.startsWith('A# '))) ||
                            (type === 'sharp' && (name.startsWith('Db ') || name.startsWith('Eb ') || name.startsWith('Gb ') || name.startsWith('Ab ') || name.startsWith('Bb ')));
        c.style.display = shouldHide ? 'none' : 'flex';
    });
}

function setNotation(type, btn) {
    currentNotation = type;
    document.querySelectorAll('.notation-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const filterBtns = document.querySelectorAll('.filter-btn');
    const keys = type === 'flat' ? flatKeys : sharpKeys;
    let activeKey = null;
    
    filterBtns.forEach((b, i) => {
        const wasActive = b.classList.contains('active');
        b.textContent = keys[i];
        if (wasActive) {
            activeKey = keys[i];
            b.classList.remove('active');
            filterScale(b);
        }
    });

    if (!activeKey) {
        updateGridNotation(type);
        animateScaleCards(visibleScaleCards(), 'in');
    }
}

// 音阶筛选：当前卡片先退场，切换状态后再让新卡片入场
async function filterScale(btn) {
    const grid = document.querySelector('.scales-grid');
    const cards = document.querySelectorAll('.scale-card');
    const btns = document.querySelectorAll('.filter-btn');
    if (!grid || scalesFilterBusy) return;

    const key = btn.textContent.trim();
    const isActive = btn.classList.contains('active');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scalesFilterBusy = true;
    if (!reduceMotion) {
        const outgoing = animateScaleCards(visibleScaleCards(), 'out');
        await Promise.all(outgoing.map(animation => whenAnimationSettles(animation, CARD_EXIT_DURATION)));
        outgoing.forEach(animation => animation.cancel());
    }

    btns.forEach(b => b.classList.remove('active'));
    if (isActive) {
        grid.classList.remove('filtered');
        updateGridNotation(currentNotation);
    } else {
        btn.classList.add('active');
        grid.classList.add('filtered');
        cards.forEach(c => {
            const name = c.querySelector('.scale-name').textContent.trim();
            c.style.display = name.startsWith(key + ' ') ? 'flex' : 'none';
        });
    }

    // 不改动画网格高度：卡片的 height:100% 会跟着网格高度被拉伸
    if (!reduceMotion) animateScaleCards(visibleScaleCards(), 'in');
    scalesFilterBusy = false;
}

document.addEventListener('DOMContentLoaded', () => {
    // core.js 初始化主题图标，此处仅初始化音阶逻辑
    updateGridNotation(currentNotation);
});
