const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 专业级音频处理链 ---
const clarityFilter = audioCtx.createBiquadFilter();
clarityFilter.type = 'peaking';
clarityFilter.frequency.value = 400;
clarityFilter.Q.value = 1.0;
clarityFilter.gain.value = -4; 

const airShelf = audioCtx.createBiquadFilter();
airShelf.type = 'highshelf';
airShelf.frequency.value = 8000;
airShelf.gain.value = 4;

const masterGain = audioCtx.createGain();
masterGain.gain.value = 4.0;

const compressor = audioCtx.createDynamicsCompressor();
compressor.threshold.value = -10; 
compressor.knee.value = 20;      
compressor.ratio.value = 8;     
compressor.attack.value = 0.003; 
compressor.release.value = 0.25; 

clarityFilter.connect(airShelf);
airShelf.connect(masterGain);
masterGain.connect(compressor);
compressor.connect(audioCtx.destination);

let settings = {
    showLabels: true,
    notation: 'natural', 
    range: 'mini'      
};

if (window.innerWidth <= 768) {
    settings.range = 'mini';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_MAP_FULL = {
    'KeyZ': 'C3', 'KeyX': 'D3', 'KeyC': 'E3', 'KeyV': 'F3', 'KeyB': 'G3', 'KeyN': 'A3', 'KeyM': 'B3', 'Comma': 'C4', 'Period': 'D4', 'Slash': 'E4',
    'KeyA': 'C4', 'KeyS': 'D4', 'KeyD': 'E4', 'KeyF': 'F4', 'KeyG': 'G4', 'KeyH': 'A4', 'KeyJ': 'B4', 'KeyK': 'C5', 'KeyL': 'D5', 'Semicolon': 'E5', 'Quote': 'F5',
    'KeyQ': 'C5', 'KeyW': 'D5', 'KeyE': 'E5', 'KeyR': 'F5', 'KeyT': 'G5', 'KeyY': 'A5', 'KeyU': 'B5', 'KeyI': 'C6', 'KeyO': 'D6', 'KeyP': 'E6', 'BracketLeft': 'F6', 'BracketRight': 'G6', 'Backslash': 'A6',
    'Digit1': 'C6', 'Digit2': 'D6', 'Digit3': 'E6', 'Digit4': 'F6', 'Digit5': 'G6', 'Digit6': 'A6', 'Digit7': 'B6', 'Digit8': 'C7', 'Digit9': 'D7', 'Digit0': 'E7', 'Minus': 'F7', 'Equal': 'G7',
    'Space': 'A4'
};
const KEY_MAP_MINI = {
    'KeyA': 'C4', 'KeyS': 'D4', 'KeyD': 'E4', 'KeyF': 'F4', 'KeyG': 'G4', 'KeyH': 'A4', 'KeyJ': 'B4', 'KeyK': 'C5', 'KeyL': 'D5', 'Semicolon': 'E5', 'Quote': 'F5',
    'KeyW': 'C#4', 'KeyE': 'D#4', 'KeyT': 'F#4', 'KeyY': 'G#4', 'KeyU': 'A#4', 'KeyO': 'C#5', 'KeyP': 'D#5',
    'Space': 'A4'
};

let currentKeyMap = KEY_MAP_MINI;
let transposeAmount = 0;
const playingNotes = new Map();
let pianoInstrument = null;
const loadingOverlay = document.getElementById('loading-overlay');

function shiftNote(note, delta) {
    if (!note || delta === 0) return note;
    const name = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    const index = NOTE_NAMES.indexOf(name);
    if (index === -1) return note;
    const totalIndex = octave * 12 + index + delta;
    const newOctave = Math.floor(totalIndex / 12);
    const newIndex = ((totalIndex % 12) + 12) % 12;
    const result = NOTE_NAMES[newIndex] + newOctave;
    return (newOctave >= 0 && newOctave <= 8) ? result : note;
}

function getDisplayNote(note, notation) {
    if (!note.includes('#')) return note;
    const octave = note.slice(-1);
    const sharp = note.slice(0, -1);
    const flats = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
    if (notation === 'sharp') return sharp + octave;
    if (notation === 'flat') return flats[sharp] + octave;
    if (notation === 'natural') {
        const naturals = { 'C#': 'C#', 'D#': 'Eb', 'F#': 'F#', 'G#': 'Ab', 'A#': 'Bb' };
        return naturals[sharp] + octave;
    }
    return sharp + '/' + flats[sharp] + octave;
}

function renderKeyboard() {
    const container = document.getElementById('piano-keys-container');
    if (!container) return;
    container.innerHTML = '';
    container.className = 'piano-keys' + (settings.showLabels ? '' : ' hide-labels');
    let notes = [];
    if (settings.range === 'mini') {
        notes = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
    } else {
        notes.push('A0', 'A#0', 'B0');
        for (let i = 1; i <= 7; i++) { NOTE_NAMES.forEach(name => notes.push(name + i)); }
        notes.push('C8');
    }
    const whiteNotes = notes.filter(n => !n.includes('#'));
    const blackNotes = notes.filter(n => n.includes('#'));
    const isMobile = window.innerWidth <= 768;
    const minWhiteWidth = isMobile ? 35 : 40;
    const totalWhiteWidth = whiteNotes.length * minWhiteWidth;
    container.style.width = settings.range === 'full' ? `${totalWhiteWidth}px` : '100%';
    whiteNotes.forEach(note => {
        const keyEl = document.createElement('div');
        keyEl.className = 'key white';
        keyEl.dataset.note = note;
        const pcKey = Object.keys(currentKeyMap).find(k => currentKeyMap[k] === note);
        if (pcKey) keyEl.dataset.key = pcKey;
        keyEl.innerHTML = `<span>${note}</span>`;
        container.appendChild(keyEl);
        bindKeyEvents(keyEl);
    });
    const whiteKeyWidthPercent = 100 / whiteNotes.length;
    blackNotes.forEach(note => {
        const keyEl = document.createElement('div');
        keyEl.className = 'key black';
        keyEl.dataset.note = note;
        const pcKey = Object.keys(currentKeyMap).find(k => currentKeyMap[k] === note);
        if (pcKey) keyEl.dataset.key = pcKey;
        const baseNote = note[0];
        const octave = note.slice(-1);
        const prevWhiteNote = baseNote + octave;
        const prevIndex = whiteNotes.indexOf(prevWhiteNote);
        if (prevIndex !== -1) {
            keyEl.style.left = `${(prevIndex + 1) * whiteKeyWidthPercent}%`;
            keyEl.style.width = `${whiteKeyWidthPercent * 0.72}%`;
            keyEl.style.marginLeft = `${whiteKeyWidthPercent * -0.36}%`;
        }
        keyEl.innerHTML = `<span>${getDisplayNote(note, settings.notation)}</span>`;
        container.appendChild(keyEl);
        bindKeyEvents(keyEl);
    });
}

window.toggleLabels = function(checkbox) {
    settings.showLabels = checkbox.checked;
    const container = document.getElementById('piano-keys-container');
    if(container) container.classList.toggle('hide-labels', !settings.showLabels);
    const notationGroup = document.getElementById('notation-group');
    if (notationGroup) notationGroup.classList.toggle('hidden', !settings.showLabels);
};

window.changeTranspose = function(delta, reset = false) {
    transposeAmount = reset ? 0 : Math.max(-12, Math.min(12, transposeAmount + delta));
    const displayStr = (transposeAmount > 0 ? '+' : '') + transposeAmount;
    document.getElementById('transpose-display').innerText = displayStr.replace('-', '−');
};

window.setPianoNotation = function(type, btn) {
    settings.notation = type;
    document.querySelectorAll('.notation-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderKeyboard();
};

window.toggleKeyboardRange = function() {
    settings.range = (settings.range === 'mini' ? 'full' : 'mini');
    const btn = document.getElementById('range-toggle-btn');
    btn.innerText = (settings.range === 'full' ? '−' : '+');
    const pianoContainer = document.querySelector('.piano-container');
    const pageContainer = document.querySelector('.container');
    if (settings.range === 'full') {
        pianoContainer.classList.add('full-range');
        if (pageContainer) pageContainer.classList.add('piano-full-width');
        currentKeyMap = KEY_MAP_FULL;
        preloadFullRangeSf();
    } else {
        pianoContainer.classList.remove('full-range');
        if (pageContainer) pageContainer.classList.remove('piano-full-width');
        currentKeyMap = KEY_MAP_MINI;
    }
    renderKeyboard();
    const parent = document.querySelector('.piano-keyboard');
    if (parent) parent.scrollLeft = settings.range === 'full' ? (parent.scrollWidth * 0.43) : 0;
};

window.switchHelpView = function(view) {
    const miniView = document.getElementById('help-view-mini');
    const fullView = document.getElementById('help-view-full');
    const btnMini = document.getElementById('btn-help-mini');
    const btnFull = document.getElementById('btn-help-full');
    miniView.style.display = view === 'mini' ? 'block' : 'none';
    fullView.style.display = view === 'full' ? 'block' : 'none';
    btnMini.classList.toggle('active', view === 'mini');
    btnFull.classList.toggle('active', view === 'full');
};

function noteOn(note, el) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!pianoInstrument || (loadingOverlay && loadingOverlay.style.visibility !== 'hidden')) return;
    if (!el || !el.classList.contains('active')) return; 
    if (playingNotes.has(note)) return;
    const transposedNote = shiftNote(note, transposeAmount);
    // 该音符所在分片尚未加载时，按需触发加载（首次点击可能无声，随后即可用）
    if (!pianoInstrument.buffers[Soundfont.noteToMidi(transposedNote)]) {
        ensureSfNote(transposedNote);
    }
    const played = pianoInstrument.play(transposedNote);
    if (played) playingNotes.set(note, played);
}

function noteOff(note) {
    const player = playingNotes.get(note);
    if (!player) return;
    playingNotes.delete(note);
    player.stop(audioCtx.currentTime + 0.1);
}

function bindKeyEvents(key) {
    key.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        // 防御性释放指针捕获：无真实指针（如合成事件）时不会中断按下逻辑
        try { key.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        key.classList.add('active');
        noteOn(key.dataset.note, key);
    });
    // 松开左键时立即释放琴键（即使指针仍悬停在键上），修复“松键后仍保持激活”的 bug
    key.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        noteOff(key.dataset.note);
        key.classList.remove('active');
    });
    key.addEventListener('pointerenter', (e) => {
        if (e.buttons === 1) {
            key.classList.add('active');
            noteOn(key.dataset.note, key);
        }
    });
    key.addEventListener('pointerleave', () => {
        noteOff(key.dataset.note);
        key.classList.remove('active');
    });
    key.addEventListener('dragstart', e => e.preventDefault());
}

const activePCKeys = new Map();
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointerup', () => {
    activePCKeys.forEach((note) => {
        noteOff(note);
        const el = document.querySelector(`.key[data-note="${note}"]`);
        if (el) el.classList.remove('active');
    });
    activePCKeys.clear();
});

window.addEventListener('keydown', e => {
    if (e.repeat || !pianoInstrument || (loadingOverlay && loadingOverlay.style.visibility !== 'hidden')) return;
    if (e.code === 'Enter') {
        const overlay = document.getElementById('piano-help-overlay');
        toggleModal('piano-help-overlay', !(overlay && overlay.classList.contains('active')));
        return;
    }
    if (currentKeyMap[e.code]) {
        if (e.code === 'Space') e.preventDefault();
        let note = currentKeyMap[e.code];
        if (e.shiftKey && e.code !== 'Space') note = shiftNote(note, 1);
        const el = document.querySelector(`.key[data-note="${note}"]`);
        if (el && !activePCKeys.has(e.code)) {
            el.classList.add('active');
            noteOn(note, el);
            activePCKeys.set(e.code, note);
        }
    }
});

window.addEventListener('keyup', e => {
    if (activePCKeys.has(e.code)) {
        const note = activePCKeys.get(e.code);
        noteOff(note);
        const el = document.querySelector(`.key[data-note="${note}"]`);
        if (el) el.classList.remove('active');
        activePCKeys.delete(e.code);
    }
});

// ---------------- 钢琴音源分片加载（按需） ----------------
// 说明：
//   core 分片 = C4~C5（迷你键盘默认音域），页面加载时优先加载；
//   其余分片按八度拆分，进入全键盘或按到未加载音符时才按需加载。
window.Soundfont = window.Soundfont || {};

const SF_DIR = '../js/soundfont/';
const SF_CHUNKS = {
    core: SF_DIR + 'acoustic_grand_piano-mp3-C4-C5.js',
    '0': SF_DIR + 'acoustic_grand_piano-mp3-A0-B0.js',
    '1': SF_DIR + 'acoustic_grand_piano-mp3-C1-B1.js',
    '2': SF_DIR + 'acoustic_grand_piano-mp3-C2-B2.js',
    '3': SF_DIR + 'acoustic_grand_piano-mp3-C3-B3.js',
    '5': SF_DIR + 'acoustic_grand_piano-mp3-Db5-B5.js',
    '6': SF_DIR + 'acoustic_grand_piano-mp3-C6-B6.js',
    '7': SF_DIR + 'acoustic_grand_piano-mp3-C7-B7.js',
    '8': SF_DIR + 'acoustic_grand_piano-mp3-C8.js'
};
const loadedSfChunks = new Set(['core']);
const sfLoading = new Map(); // url -> Promise

// 音符名（如 "C#4"）→ 所属分片 key
function sfChunkOf(note) {
    const m = note.match(/^([A-G]#?)(\d+)$/);
    if (!m) return null;
    const oct = parseInt(m[2], 10);
    if (oct === 4) return 'core';
    if (oct === 5) return m[1] === 'C' ? 'core' : '5';
    return String(oct);
}

// 加载并合并一个分片到主乐器
function loadSfChunk(key) {
    const url = SF_CHUNKS[key];
    if (!url || loadedSfChunks.has(key)) return Promise.resolve();
    if (sfLoading.has(url)) return sfLoading.get(url);
    const p = Soundfont.instrument(audioCtx, url, { destination: clarityFilter })
        .then(chunkPlayer => {
            if (pianoInstrument) Object.assign(pianoInstrument.buffers, chunkPlayer.buffers);
            loadedSfChunks.add(key);
        })
        .catch(err => console.warn('音源分片加载失败:', key, err));
    sfLoading.set(url, p);
    return p;
}

// 确保某音符对应的分片已加载（未加载则触发）
function ensureSfNote(note) {
    const key = sfChunkOf(note);
    if (key) loadSfChunk(key);
}

// 全键盘模式：按序预载剩余分片（从常用音区向两侧扩散）
const SF_PRELOAD_ORDER = ['3', '5', '2', '6', '1', '7', '0', '8'];
let sfFullRangePreloaded = false;
function preloadFullRangeSf() {
    if (sfFullRangePreloaded) return;
    sfFullRangePreloaded = true;
    SF_PRELOAD_ORDER.reduce((chain, key) => chain.then(() => loadSfChunk(key)), Promise.resolve());
}

// 优先加载核心分片（C4~C5），就绪后渲染键盘并解锁
Soundfont.instrument(audioCtx, SF_CHUNKS.core, { destination: clarityFilter }).then(piano => {
    pianoInstrument = piano; 
    setTimeout(() => {
        renderKeyboard(); 
        if(loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => { loadingOverlay.style.visibility = 'hidden'; }, 400);
        }
        showToast(document.documentElement.lang === 'en-US' ? "Piano sounds ready" : "钢琴音源已就绪");
    }, 300);
}).catch(err => {
    console.error('钢琴音源加载失败:', err);
    // 关闭加载弹窗，避免永久卡在加载界面
    if(loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.visibility = 'hidden'; }, 400);
    }
    showToast(document.documentElement.lang === 'en-US' ? 'Failed to load piano sounds' : '钢琴音源加载失败', true);
});