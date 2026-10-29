/**
 * 调音器逻辑类
 */
class FrequencyAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.buffer = null;
        this.isRunning = false;
        this.sampleRate = 0;
        this.lastFreq = 0; // 用于平滑处理
        this.smoothedFreq = 0;
        this.notation = 'natural'; // 默认为还原号（混合模式）
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096; // 增加缓冲区大小以提高低频分辨率
            this.buffer = new Float32Array(this.analyser.fftSize);
            
            const source = this.audioContext.createMediaStreamSource(stream);

            // 增加低通滤波器，过滤掉高频噪音
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2500, this.audioContext.currentTime); // 提高上限以支持 C7 (2093Hz)
            filter.Q.setValueAtTime(1, this.audioContext.currentTime);

            source.connect(filter);
            filter.connect(this.analyser);
            
            this.isRunning = true;
            this.stream = stream; // 保存流以便停止
            this.update();
            return true;
        } catch (e) {
            console.error("Microphone access failed:", e);
            return false;
        }
    }

    stop() {
        this.isRunning = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    setNotation(type, btn) {
        this.notation = type;
        document.querySelectorAll('.notation-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    update() {
        if (!this.isRunning) return;
        
        this.analyser.getFloatTimeDomainData(this.buffer);
        const freq = this.autoCorrelate(this.buffer, this.sampleRate);
        
        if (freq !== -1) {
            this.onPitchDetected(freq);
        }
        
        requestAnimationFrame(() => this.update());
    }

    autoCorrelate(buffer, sampleRate) {
        // Determine the effective size of the buffer to analyze
        let size = buffer.length;
        let rms = 0;

        // Calculate Root Mean Square (RMS) to check for signal presence
        for (let i = 0; i < size; i++) { rms += buffer[i] * buffer[i]; }
        rms = Math.sqrt(rms / size);
        
        // If RMS is below a certain threshold, consider it silence or too quiet
        const SILENCE_THRESHOLD_RMS = 0.01;
        if (rms < SILENCE_THRESHOLD_RMS) return -1;

        // Find the first and last points where the signal crosses a threshold
        // This helps to trim silent or very low-amplitude parts at the edges,
        // which can interfere with autocorrelation accuracy.
        let r1 = 0, r2 = size - 1, thres = 0.2;
        const HALF_SIZE = size / 2;
        for (let i = 0; i < HALF_SIZE; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < HALF_SIZE; i++) if (Math.abs(buffer[size - i]) < thres) { r2 = size - i; break; }

        // Slice the buffer to the effective signal range
        const buf = buffer.slice(r1, r2);
        size = buf.length;

        // Calculate the autocorrelation function
        // c[i] stores the sum of products of buf[j] and buf[j+i]
        let c = new Float32Array(size).fill(0);
        for (let i = 0; i < size; i++)
            for (let j = 0; j < size - i; j++)
                c[i] = c[i] + buf[j] * buf[j + i];

        // Find the first zero-crossing or minimum after the initial peak (lag 0)
        // This helps to find the fundamental frequency's peak, not just any peak.
        let d = 0; while (c[d] > c[d + 1]) d++;

        // Find the maximum value in the autocorrelation function after the initial drop
        let maxval = -1, maxpos = -1;
        for (let i = d; i < size; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        // Perform parabolic interpolation to get a more precise peak location
        let T0 = maxpos; 
        if (maxpos > 0 && maxpos < size - 1) {
            const y1 = c[maxpos - 1];
            const y2 = c[maxpos];
            const y3 = c[maxpos + 1];
            const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
            T0 = maxpos + delta;
        }

        // Convert the period (T0) to frequency
        return sampleRate / T0;
    }

    onPitchDetected(freq) {
        if (this.lastFreq > 0 && (freq > this.lastFreq * 4 || freq < this.lastFreq / 4)) {
            return;
        }
        this.lastFreq = freq;

        const alpha = 0.2;
        this.smoothedFreq = (alpha * freq) + (1 - alpha) * this.smoothedFreq;
        if (Math.abs(this.smoothedFreq - freq) > 20) this.smoothedFreq = freq;

        const currentFreq = this.smoothedFreq;
        
        if (currentFreq < 60 || currentFreq > 2200) {
            this.uiUpdate(0, "—", 0);
            return;
        }

        const notationMap = {
            'sharp':   ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
            'flat':    ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
            'natural': ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
        };

        const names = notationMap[this.notation];
        const n = Math.round(12 * Math.log2(currentFreq / 440)) + 69;
        const octave = Math.floor(n / 12) - 1;
        const noteName = names[n % 12] + octave;

        const standardFreq = 440 * Math.pow(2, (n - 69) / 12);
        const cents = 1200 * Math.log2(currentFreq / standardFreq);
        
        this.uiUpdate(currentFreq, noteName, cents);
    }

    uiUpdate(freq, noteName, cents) {
        const hzDisplay = document.getElementById('hz-display');
        const noteDisplay = document.getElementById('note-display');
        const pointer = document.getElementById('pointer');

        if (freq === 0) {
            if (hzDisplay) hzDisplay.innerText = "0.0";
            if (noteDisplay) noteDisplay.innerText = "—";
            if (pointer) pointer.style.transform = `translateX(-50%) rotate(0deg)`;
            return;
        }
        if (hzDisplay) hzDisplay.innerText = freq.toFixed(1);
        if (noteDisplay) noteDisplay.innerText = noteName;
        
        const angle = Math.max(-50, Math.min(50, cents)) * 0.9; 
        if (pointer) pointer.style.transform = `translateX(-50%) rotate(${angle.toFixed(1)}deg)`;
    }
}

const analyzerApp = new FrequencyAnalyzer();
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

if (startBtn) {
    startBtn.onclick = async () => {
        const isEn = document.documentElement.lang === 'en-US';
        if (!analyzerApp.isRunning) {
            const success = await analyzerApp.start();
            if (success) {
                startBtn.innerText = isEn ? "Stop Analysis" : "停止分析";
                if (statusText) statusText.innerText = isEn ? "Listening to audio..." : "正在监听音频...";
            }
        } else {
            analyzerApp.stop();
            startBtn.innerText = isEn ? "Start Analysis" : "开始分析";
            if (statusText) statusText.innerText = isEn ? "Click the button and grant microphone access" : "点击按钮并授权麦克风";
            analyzerApp.uiUpdate(0, "—", 0);
        }
    };
}