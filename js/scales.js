// 符号切换逻辑
let currentNotation = 'flat';
const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const sharpKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function updateGridNotation(type, animate = false) {
    const cards = document.querySelectorAll('.scale-card');
    cards.forEach(c => {
        const name = c.querySelector('.scale-name').textContent.trim();
        const shouldHide = (type === 'flat' && (name.startsWith('C# ') || name.startsWith('D# ') || name.startsWith('F# ') || name.startsWith('G# ') || name.startsWith('A# '))) ||
                            (type === 'sharp' && (name.startsWith('Db ') || name.startsWith('Eb ') || name.startsWith('Gb ') || name.startsWith('Ab ') || name.startsWith('Bb ')));
        c.style.display = shouldHide ? 'none' : 'flex';
        if (animate && !shouldHide) {
            c.classList.remove('appearing');
            void c.offsetWidth;
            c.classList.add('appearing');
        }
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

    if (!activeKey) updateGridNotation(type, true);
}

// 音阶筛选逻辑
function filterScale(btn) {
    const key = btn.textContent.trim();
    const grid = document.querySelector('.scales-grid');
    const cards = document.querySelectorAll('.scale-card');
    const btns = document.querySelectorAll('.filter-btn');
    const isActive = btn.classList.contains('active');

    // 清除按钮激活状态
    btns.forEach(b => b.classList.remove('active'));

    if (isActive) {
        // 如果是取消选择：让所有卡片丝滑地“归位”
        grid.classList.remove('filtered');
        updateGridNotation(currentNotation, true);
    } else {
        // 如果是选中某个调：执行筛选
        btn.classList.add('active');
        grid.classList.add('filtered');
        cards.forEach(c => {
            const name = c.querySelector('.scale-name').textContent.trim();
            if (name.startsWith(key + ' ')) {
                c.style.display = 'flex';
                c.classList.remove('appearing');
                void c.offsetWidth;
                c.classList.add('appearing');
            } else {
                c.style.display = 'none';
                c.classList.remove('appearing');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // core.js 初始化主题图标，此处仅初始化音阶逻辑
    updateGridNotation(currentNotation);
});
