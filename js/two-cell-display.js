/**
 * Two-Cell Braille Display & Full-Text Ribbon Engine
 * -------------------------------------------------------------
 * Bridges linguistic multi-character text and 2-cell (12-solenoid) hardware.
 * Physical Pin Mapping (3 rows x 4 columns):
 *   [ CELL 1 ]      [ CELL 2 ]
 *    1     4         7     10     (Row 1: Top)
 *    2     5         8     11     (Row 2: Mid)
 *    3     6         9     12     (Row 3: Bot)
 */

class TwoCellDisplayEngine {
    constructor(options = {}) {
        this.serialManager = options.serialManager || (typeof window !== 'undefined' ? window.esp32Serial : null);
        this.currentText = '';
        this.cells = [];            // Array of { char: string, dots: number[] }
        this.frames = [];           // Array of { cell1: object, cell2: object, bitstring: string }
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeedMs = 3500;    // Default 3.5 seconds per frame

        // UI Element IDs
        this.ribbonContainerId = options.ribbonContainerId || 'textRibbonTrack';
        this.twoCellContainerId = options.twoCellContainerId || 'twoCellTactileBoard';
        this.frameIndicatorId = options.frameIndicatorId || 'frameCounterBadge';
        this.bitstringDisplayId = options.bitstringDisplayId || 'activeBitstringDisplay';

        this.onFrameChange = options.onFrameChange || null;
    }

    /**
     * Convert dots array (1..6) to Unicode Braille glyph (U+2800..U+28FF)
     */
    static dotsToBrailleChar(dots) {
        if (!dots || dots.length === 0) return '⠀'; // Blank braille pattern
        let mask = 0;
        dots.forEach(d => {
            if (d >= 1 && d <= 6) {
                mask |= (1 << (d - 1));
            } else if (d === 7) {
                mask |= (1 << 6);
            } else if (d === 8) {
                mask |= (1 << 7);
            }
        });
        return String.fromCharCode(0x2800 + mask);
    }

    /**
     * Build 12-bit binary string from two 6-dot cells
     * Cell 1: dots 1..6 -> indices 0..5
     * Cell 2: dots 1..6 -> indices 6..11 (representing physical pins 7..12)
     */
    static cellsTo12Bitstring(cell1Dots = [], cell2Dots = []) {
        const bits = new Array(12).fill('0');

        // Cell 1: dots 1-6 -> bits 0-5
        cell1Dots.forEach(d => {
            if (d >= 1 && d <= 6) bits[d - 1] = '1';
        });

        // Cell 2: dots 1-6 -> bits 6-11 (physical pins 7-12)
        cell2Dots.forEach(d => {
            if (d >= 1 && d <= 6) bits[d - 1 + 6] = '1';
        });

        return bits.join('');
    }

    /**
     * Update text, transliterate, and slice into 2-cell frames
     */
    setText(text) {
        this.currentText = String(text || '').trim();
        this.cells = this.transliterateToCells(this.currentText);
        this.buildFrames();
        this.currentFrameIndex = 0;
        this.render();
        this.emitCurrentFrame();
    }

    /**
     * Transliterate text using Thai/English engine
     */
    transliterateToCells(text) {
        if (!text) return [];

        // Check if full thai-braille engine is present in environment
        if (typeof textToBrailleCells === 'function') {
            try {
                const res = textToBrailleCells(text);
                return res.map(item => {
                    let c = (item.source !== undefined && item.source !== null && item.source !== '') ? item.source : item.char;
                    if (!c) {
                        c = (item.kind === 'space') ? ' ' : ((item.dots && item.dots.length) ? '·' : ' ');
                    }
                    return { char: c, dots: item.dots || [] };
                });
            } catch (e) {
                console.warn('textToBrailleCells failed, falling back to basic mapper', e);
            }
        } else if (typeof window !== 'undefined' && window.ThaiBraille && typeof window.ThaiBraille.textToBrailleCells === 'function') {
            try {
                const res = window.ThaiBraille.textToBrailleCells(text);
                return res.map(item => {
                    let c = (item.source !== undefined && item.source !== null && item.source !== '') ? item.source : item.char;
                    if (!c) {
                        c = (item.kind === 'space') ? ' ' : ((item.dots && item.dots.length) ? '·' : ' ');
                    }
                    return { char: c, dots: item.dots || [] };
                });
            } catch (e) {
                console.warn('ThaiBraille.textToBrailleCells failed, falling back to basic mapper', e);
            }
        }

        // Fallback or Node.js basic transliteration
        return this.basicTransliterate(text);
    }

    /**
     * Basic transliterator supporting English, digits, and common Thai letters
     */
    basicTransliterate(text) {
        const cells = [];
        const latinMap = {
            'a': [1], 'b': [1,2], 'c': [1,4], 'd': [1,4,5], 'e': [1,5],
            'f': [1,2,4], 'g': [1,2,4,5], 'h': [1,2,5], 'i': [2,4], 'j': [2,4,5],
            'k': [1,3], 'l': [1,2,3], 'm': [1,3,4], 'n': [1,3,4,5], 'o': [1,3,5],
            'p': [1,2,3,4], 'q': [1,2,3,4,5], 'r': [1,2,3,5], 's': [2,3,4], 't': [2,3,4,5],
            'u': [1,3,6], 'v': [1,2,3,6], 'w': [2,4,5,6], 'x': [1,3,4,6], 'y': [1,3,4,5,6], 'z': [1,3,5,6],
            ' ': []
        };
        const digitMap = {
            '0': [2,4,5], '1': [1], '2': [1,2], '3': [1,4], '4': [1,4,5],
            '5': [1,5], '6': [1,2,4], '7': [1,2,4,5], '8': [1,2,5], '9': [2,4]
        };

        let inNumberMode = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const lower = ch.toLowerCase();

            if (/\d/.test(ch)) {
                // If entering number mode, add Braille Number Sign (dots 3,4,5,6)
                if (!inNumberMode) {
                    cells.push({ char: '#', dots: [3, 4, 5, 6], isIndicator: true });
                    inNumberMode = true;
                }
                cells.push({ char: ch, dots: digitMap[ch] || [] });
            } else {
                inNumberMode = false;
                if (latinMap[lower] !== undefined) {
                    cells.push({ char: ch, dots: latinMap[lower] });
                } else {
                    // Check if Thai consonant/vowel in global table
                    let thaiCell = null;
                    if (typeof THAI_BRAILLE_TABLES !== 'undefined') {
                        if (THAI_BRAILLE_TABLES.THAI_CONSONANTS && THAI_BRAILLE_TABLES.THAI_CONSONANTS[ch]) {
                            thaiCell = THAI_BRAILLE_TABLES.THAI_CONSONANTS[ch].cells[0];
                        } else if (THAI_BRAILLE_TABLES.THAI_SIMPLE_VOWELS && THAI_BRAILLE_TABLES.THAI_SIMPLE_VOWELS[ch]) {
                            thaiCell = THAI_BRAILLE_TABLES.THAI_SIMPLE_VOWELS[ch].cells[0];
                        }
                    }
                    cells.push({ char: ch, dots: thaiCell || [1, 2, 3, 4, 5, 6] });
                }
            }
        }

        return cells;
    }

    /**
     * Slice cells array into 2-cell frames
     */
    buildFrames() {
        this.frames = [];
        if (this.cells.length === 0) {
            this.frames.push({
                cell1: { char: ' ', dots: [] },
                cell2: { char: ' ', dots: [] },
                bitstring: '000000000000'
            });
            return;
        }

        for (let i = 0; i < this.cells.length; i += 2) {
            const c1 = this.cells[i];
            const c2 = (i + 1 < this.cells.length) ? this.cells[i + 1] : { char: ' ', dots: [] };
            const bitstring = TwoCellDisplayEngine.cellsTo12Bitstring(c1.dots, c2.dots);

            this.frames.push({
                cell1: c1,
                cell2: c2,
                bitstring: bitstring,
                frameIndex: this.frames.length,
                startIndex: i
            });
        }
    }

    /**
     * Get current active frame
     */
    getCurrentFrame() {
        if (this.frames.length === 0) return null;
        return this.frames[this.currentFrameIndex] || this.frames[0];
    }

    /**
     * Navigation
     */
    nextFrame() {
        if (this.frames.length <= 1) return;
        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
        this.render();
        this.emitCurrentFrame();
    }

    prevFrame() {
        if (this.frames.length <= 1) return;
        this.currentFrameIndex = (this.currentFrameIndex - 1 + this.frames.length) % this.frames.length;
        this.render();
        this.emitCurrentFrame();
    }

    jumpToFrame(index) {
        if (index >= 0 && index < this.frames.length) {
            this.currentFrameIndex = index;
            this.render();
            this.emitCurrentFrame();
        }
    }

    jumpToCellIndex(cellIndex) {
        const frameIdx = Math.floor(cellIndex / 2);
        this.jumpToFrame(frameIdx);
    }

    /**
     * Auto-Play Toggle
     */
    toggleAutoPlay() {
        if (this.isPlaying) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }
        return this.isPlaying;
    }

    startAutoPlay() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        // Immediately actuate current frame for the configured pulse duration
        this.triggerPulseActuation();

        this.playInterval = setInterval(() => {
            this.nextFrame();
            this.triggerPulseActuation();
        }, this.playSpeedMs);
        this.updatePlayControlsUI();
    }

    stopAutoPlay() {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.releaseActuation();
        this.updatePlayControlsUI();
    }

    setSpeed(speedMs) {
        this.playSpeedMs = Math.max(1000, Math.min(10000, Number(speedMs) || 3500));
        if (this.isPlaying) {
            this.stopAutoPlay();
            this.startAutoPlay();
        }
    }

    /**
     * Trigger Pulse Actuation (ดันหมุดชั่วคราวตามเวลาวินาทีที่ตั้งไว้ แล้วตัดไฟอัตโนมัติ)
     */
    triggerPulseActuation(durationMs = null) {
        const frame = this.getCurrentFrame();
        if (!frame) return;

        const holdTime = durationMs || this.playSpeedMs || 3500;
        this.isActuating = true;

        // Clear existing pulse timeout if active
        if (this.pulseTimeout) {
            clearTimeout(this.pulseTimeout);
            this.pulseTimeout = null;
        }

        // Send active 12-bit command to ESP32
        if (this.serialManager && typeof this.serialManager.send12BitCommand === 'function') {
            this.serialManager.send12BitCommand(frame.bitstring);
        }

        this.updatePulseUI(true);

        if (typeof this.onFrameChange === 'function') {
            this.onFrameChange(frame);
        }

        // Set safety release timer: cutoff power (000000000000) after holdTime
        this.pulseTimeout = setTimeout(() => {
            this.releaseActuation();
        }, holdTime);
    }

    /**
     * Release Actuation / Cutoff Power (ตัดไฟโซลินอยด์ทันทีเพื่อป้องกันความร้อน)
     */
    releaseActuation() {
        this.isActuating = false;
        if (this.pulseTimeout) {
            clearTimeout(this.pulseTimeout);
            this.pulseTimeout = null;
        }

        const zeroBits = '000000000000';
        if (this.serialManager && typeof this.serialManager.send12BitCommand === 'function') {
            this.serialManager.send12BitCommand(zeroBits);
        }

        this.updatePulseUI(false);
    }

    /**
     * Update Pulse Button UI state
     */
    updatePulseUI(active) {
        const pulseBtn = document.getElementById('btnPulseActuate');
        if (pulseBtn) {
            if (active) {
                pulseBtn.classList.add('actuating');
                pulseBtn.innerHTML = '<i class="fa-solid fa-bolt-lightning fa-beat"></i> <span>กำลังดันหมุด...</span>';
            } else {
                pulseBtn.classList.remove('actuating');
                pulseBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>ดันหมุดแสดงผล</span>';
            }
        }
    }

    /**
     * Send current 12-bit string to ESP32 Serial (Hook)
     */
    emitCurrentFrame() {
        const frame = this.getCurrentFrame();
        if (!frame) return;

        if (typeof this.onFrameChange === 'function') {
            this.onFrameChange(frame);
        }
    }

    /**
     * Render UI Components
     */
    render() {
        if (typeof document === 'undefined') return;

        this.renderRibbon();
        this.renderTwoCellTwin();
        this.renderIndicators();
        this.updatePlayControlsUI();
    }

    renderRibbon() {
        const ribbonEl = document.getElementById(this.ribbonContainerId);
        if (!ribbonEl) return;

        ribbonEl.innerHTML = '';
        if (this.cells.length === 0) {
            ribbonEl.innerHTML = '<div class="ribbon-empty-tip">พิมพ์ข้อความหรือเลือกคำศัพท์เพื่อเริ่มต้นแสดงผล</div>';
            return;
        }

        const activeStart = this.currentFrameIndex * 2;
        const activeEnd = activeStart + 1;

        this.cells.forEach((cell, idx) => {
            const cellCard = document.createElement('div');
            const isActive = (idx === activeStart || idx === activeEnd);
            cellCard.className = `ribbon-cell-card ${isActive ? 'active-cell' : ''}`;
            cellCard.title = `ตัวอักษร: ${cell.char} (เซลล์ที่ ${idx + 1})`;

            const brailleChar = TwoCellDisplayEngine.dotsToBrailleChar(cell.dots);

            cellCard.innerHTML = `
                <div class="ribbon-cell-char">${cell.char}</div>
                <div class="ribbon-cell-braille">${brailleChar}</div>
                <div class="ribbon-cell-idx">${idx + 1}</div>
            `;

            cellCard.addEventListener('click', () => {
                this.jumpToCellIndex(idx);
            });

            ribbonEl.appendChild(cellCard);
        });
    }

    renderTwoCellTwin() {
        const container = document.getElementById(this.twoCellContainerId);
        if (!container) return;

        const frame = this.getCurrentFrame();
        if (!frame) return;

        const bits = frame.bitstring; // 12-char string

        // Build 12 tactile pins in 3 rows x 4 cols:
        // Col 1 (C1L): Pin 1, 2, 3
        // Col 2 (C1R): Pin 4, 5, 6
        // Col 3 (C2L): Pin 7, 8, 9
        // Col 4 (C2R): Pin 10, 11, 12
        const pinOrder = [
            [1, 4, 7, 10], // Row 1
            [2, 5, 8, 11], // Row 2
            [3, 6, 9, 12]  // Row 3
        ];

        let gridHtml = '<div class="tactile-matrix-grid">';
        for (let row = 0; row < 3; row++) {
            gridHtml += '<div class="tactile-row">';
            for (let col = 0; col < 4; col++) {
                const pinNum = pinOrder[row][col];
                const isRaised = (bits[pinNum - 1] === '1');
                const cellGroup = pinNum <= 6 ? 'c1' : 'c2';
                
                // Which L298N driver handles this pin?
                let driver = 'L298N #1';
                if (pinNum >= 5 && pinNum <= 8) driver = 'L298N #2';
                if (pinNum >= 9 && pinNum <= 12) driver = 'L298N #3';

                gridHtml += `
                    <div class="tactile-pin-wrap ${cellGroup}">
                        <div class="tactile-pin ${isRaised ? 'raised' : 'recessed'}" id="pin-${pinNum}" title="หมุดที่ ${pinNum} (${driver}) - ${isRaised ? 'ดันขึ้น (1)' : 'ยุบตัว (0)'}">
                            <span class="pin-head"></span>
                            <span class="pin-label">${pinNum}</span>
                        </div>
                    </div>
                `;
            }
            gridHtml += '</div>';
        }
        gridHtml += '</div>';

        container.innerHTML = gridHtml;
    }

    renderIndicators() {
        // Frame Counter
        const counterEl = document.getElementById(this.frameIndicatorId);
        if (counterEl) {
            const total = Math.max(1, this.frames.length);
            const curr = this.frames.length === 0 ? 1 : this.currentFrameIndex + 1;
            counterEl.textContent = `เฟรม ${curr}/${total}`;
        }

        // Active Bitstring Display
        const bitEl = document.getElementById(this.bitstringDisplayId);
        if (bitEl) {
            const frame = this.getCurrentFrame();
            if (frame) {
                const c1 = frame.bitstring.substring(0, 6);
                const c2 = frame.bitstring.substring(6, 12);
                bitEl.innerHTML = `<span class="bit-chunk c1">${c1}</span> <span class="bit-chunk c2">${c2}</span>`;
            }
        }
    }

    updatePlayControlsUI() {
        const playBtn = document.getElementById('btnToggleAutoPlay');
        if (playBtn) {
            if (this.isPlaying) {
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>หยุด</span>';
                playBtn.classList.add('playing');
            } else {
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>เล่นอัตโนมัติ</span>';
                playBtn.classList.remove('playing');
            }
        }
    }
}

// Global browser registration
if (typeof window !== 'undefined') {
    window.TwoCellDisplayEngine = TwoCellDisplayEngine;
}

// Node.js CommonJS export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TwoCellDisplayEngine };
}
