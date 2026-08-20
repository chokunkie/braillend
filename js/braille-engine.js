/* =========================================================================
   BraillLens 3D & Optical OCR System - Braille Translation & Pagination Engine
   Version: 3.1.0 (Modular Braille Core)
   ========================================================================= */

/* THAI & INTERNATIONAL BRAILLE DICTIONARY */
const THAI_BRAILLE_MAP = {
    // Consonants
    'ก': [1, 2, 4, 5], 'ข': [1, 3], 'ฃ': [1, 3], 'ค': [1, 3, 6], 'ฅ': [1, 3, 6], 'ฆ': [1, 2, 3, 4, 6],
    'ง': [1, 3, 4, 5, 6], 'จ': [1, 4], 'ฉ': [1, 4, 6], 'ช': [1, 4, 5], 'ซ': [1, 3, 5, 6], 'ฌ': [1, 2, 3, 4, 5],
    'ญ': [1, 2, 4, 6], 'ฎ': [1, 2, 3, 4, 5, 6], 'ฏ': [2, 3, 4, 5, 6], 'ฐ': [1, 2, 5, 6], 'ฑ': [1, 2, 4, 5, 6],
    'ฒ': [1, 3, 4, 6], 'ณ': [1, 3, 4, 5], 'ด': [1, 4, 5], 'ต': [2, 3, 4, 5], 'ถ': [1, 2, 3, 4],
    'ท': [2, 3, 4, 5, 6], 'ธ': [2, 3, 4, 6], 'น': [1, 3, 4, 5], 'บ': [1, 2], 'ป': [1, 2, 3, 4],
    'ผ': [1, 2, 3, 6], 'ฝ': [1, 2, 4], 'พ': [1, 2, 3, 5], 'ฟ': [1, 2, 4, 5], 'ภ': [1, 2, 3, 4, 5],
    'ม': [1, 3, 4], 'ย': [1, 3, 4, 5, 6], 'ร': [1, 2, 3, 5], 'ล': [1, 2, 3], 'ว': [2, 4, 5, 6],
    'ศ': [1, 2, 3, 4, 6], 'ษ': [1, 2, 3, 5, 6], 'ส': [2, 3, 4], 'ห': [1, 2, 5], 'ฬ': [1, 2, 3, 4, 5],
    'อ': [1, 3, 5], 'ฮ': [1, 2, 3, 4, 5, 6],

    // Vowels & Tones
    'ะ': [1], 'า': [3, 4, 5], 'ิ': [2, 4], 'ี': [3, 5], 'ึ': [2, 4, 6], 'ื': [1, 2, 4, 6],
    'ุ': [1, 3, 6], 'ู': [1, 2, 5, 6], 'เ': [1, 5], 'แ': [1, 2, 6], 'โ': [1, 3, 5],
    'ใ': [1, 3, 4, 6], 'ไ': [1, 2, 3, 4], 'ำ': [2, 3, 6], '็': [2, 5], '่': [3, 5], '้': [2, 5, 6],
    '๊': [2, 3, 5, 6], '๋': [2, 3, 6], '์': [3, 5, 6],

    // English Uppercase / Lowercase
    'A': [1], 'a': [1], 'B': [1, 2], 'b': [1, 2], 'C': [1, 4], 'c': [1, 4], 'D': [1, 4, 5], 'd': [1, 4, 5],
    'E': [1, 5], 'e': [1, 5], 'F': [1, 2, 4], 'f': [1, 2, 4], 'G': [1, 2, 4, 5], 'g': [1, 2, 4, 5],
    'H': [1, 2, 5], 'h': [1, 2, 5], 'I': [2, 4], 'i': [2, 4], 'J': [2, 4, 5], 'j': [2, 4, 5],
    'K': [1, 3], 'k': [1, 3], 'L': [1, 2, 3], 'l': [1, 2, 3], 'M': [1, 3, 4], 'm': [1, 3, 4],
    'N': [1, 3, 4, 5], 'n': [1, 3, 4, 5], 'O': [1, 3, 5], 'o': [1, 3, 5], 'P': [1, 2, 3, 4], 'p': [1, 2, 3, 4],
    'Q': [1, 2, 3, 4, 5], 'q': [1, 2, 3, 4, 5], 'R': [1, 2, 3, 5], 'r': [1, 2, 3, 5], 'S': [2, 3, 4], 's': [2, 3, 4],
    'T': [2, 3, 4, 5], 't': [2, 3, 4, 5], 'U': [1, 3, 6], 'u': [1, 3, 6], 'V': [1, 2, 3, 6], 'v': [1, 2, 3, 6],
    'W': [2, 4, 5, 6], 'w': [2, 4, 5, 6], 'X': [1, 3, 4, 6], 'x': [1, 3, 4, 6], 'Y': [1, 3, 4, 5, 6], 'y': [1, 3, 4, 5, 6],
    'Z': [1, 3, 5, 6], 'z': [1, 3, 5, 6],

    // Numbers (0-9)
    '1': [1], '2': [1, 2], '3': [1, 4], '4': [1, 4, 5], '5': [1, 5],
    '6': [1, 2, 4], '7': [1, 2, 4, 5], '8': [1, 2, 5], '9': [2, 4], '0': [2, 4, 5],
    '#': [3, 4, 5, 6] // Number sign prefix
};

// Global Translation & Pagination States
let currentText = 'HELLO WORLD';
let currentBrailleChunks = ['HELLO WORLD'];
let currentBraillePageIndex = 0;
let currentBrailleFullText = 'HELLO WORLD';
let currentLanguageMode = 'eng';

/**
 * Converts input text into 14-cell Braille dot activation data structures
 */
function convertThaiToBraille(text) {
    const chars = Array.from(text || '');
    const cells = [];
    for (let c = 0; c < 14; c++) {
        const char = chars[c] || ' ';
        let activeDots = THAI_BRAILLE_MAP[char];
        if (!activeDots) {
            if (char.toUpperCase() in THAI_BRAILLE_MAP) {
                activeDots = THAI_BRAILLE_MAP[char.toUpperCase()];
            } else if (char.toLowerCase() in THAI_BRAILLE_MAP) {
                activeDots = THAI_BRAILLE_MAP[char.toLowerCase()];
            } else {
                activeDots = [];
            }
        }
        const dotsBool = [1, 2, 3, 4, 5, 6].map(dot => activeDots.includes(dot));
        cells.push({
            char: char,
            activeDots: activeDots,
            dotsBool: dotsBool
        });
    }
    return cells;
}

/**
 * Splits arbitrary length text into 14-character pagination chunks
 */
function chunkTextForBraille(text) {
    const chars = Array.from(text || '');
    if (chars.length === 0) return [''];
    const chunks = [];
    const CHUNK_SIZE = 14;
    for (let i = 0; i < chars.length; i += CHUNK_SIZE) {
        chunks.push(chars.slice(i, i + CHUNK_SIZE).join(''));
    }
    return chunks;
}

/**
 * Updates UI pagination buttons, badge, OLED texture, 3D pins, and 2D matrix cards
 */
function updatePaginationDisplay() {
    if (!currentBrailleChunks || currentBrailleChunks.length === 0) {
        currentBrailleChunks = [''];
    }

    const totalPages = Math.max(1, currentBrailleChunks.length);
    if (currentBraillePageIndex < 0) currentBraillePageIndex = 0;
    if (currentBraillePageIndex >= totalPages) currentBraillePageIndex = totalPages - 1;

    const currentPage = currentBraillePageIndex + 1;
    const currentChunk = currentBrailleChunks[currentBraillePageIndex] || '';
    const totalChars = Array.from(currentBrailleFullText || '').length;
    const startCharIdx = totalChars === 0 ? 0 : currentBraillePageIndex * 14 + 1;
    const endCharIdx = totalChars === 0 ? 0 : Math.min((currentBraillePageIndex + 1) * 14, totalChars);

    // 1. Update UI Elements (Page indicator & Prev/Next button states)
    const pageIndicator = document.getElementById('pageIndicator');
    if (pageIndicator) {
        pageIndicator.innerText = `PAGE ${currentPage}/${totalPages}`;
    }

    const btnPrev = document.getElementById('btnPrevPage');
    if (btnPrev) {
        btnPrev.disabled = (currentBraillePageIndex === 0);
    }

    const btnNext = document.getElementById('btnNextPage');
    if (btnNext) {
        btnNext.disabled = (currentBraillePageIndex >= totalPages - 1);
    }

    // 2. Realtime Update 3D OLED Display & Flash DATA LED
    if (typeof drawScreenTexture === 'function') {
        drawScreenTexture(currentChunk);
    }
    if (typeof flashDataLED === 'function') {
        flashDataLED();
    }

    // 3. Convert current 14-char chunk to Braille cells data
    const cellsData = convertThaiToBraille(currentChunk);
    const dotOrder = [1, 4, 2, 5, 3, 6];

    // 4. Update 3D target array for 84 pins
    if (typeof pinTargetY !== 'undefined' && typeof pinTargetCamAngle !== 'undefined') {
        for (let c = 0; c < 14; c++) {
            const cell = cellsData[c];
            for (let k = 0; k < 6; k++) {
                const dotNum = dotOrder[k];
                const isActive = cell.activeDots.includes(dotNum);
                const globalPinIdx = c * 6 + k;

                const targetY = isActive ? 0.13 : 0.0;
                const targetCamAngle = isActive ? Math.PI : 0.0;

                pinTargetY[globalPinIdx] = targetY;
                pinTargetCamAngle[globalPinIdx] = targetCamAngle;

                if (typeof pinMeshes !== 'undefined' && pinMeshes[globalPinIdx]) {
                    pinMeshes[globalPinIdx].targetY = targetY;
                    pinMeshes[globalPinIdx].targetCamAngle = targetCamAngle;
                }

                if (typeof currentActiveState !== 'undefined' && currentActiveState[c]) {
                    currentActiveState[c][k] = isActive;
                }
            }
        }
    }

    // 5. Update 2D Braille matrix preview on web page
    const gridContainer = document.getElementById('cellsGrid');
    if (gridContainer) {
        gridContainer.innerHTML = '';
        for (let c = 0; c < 14; c++) {
            const cell = cellsData[c];
            const card = document.createElement('div');
            card.className = 'cell-card';
            card.id = `cell-card-${c}`;
            card.onclick = () => selectCellCard(c);

            let dotsHTML = '';
            for (let d of dotOrder) {
                const act = cell.activeDots.includes(d) ? 'active' : '';
                dotsHTML += `<div class="dot-pin ${act}"></div>`;
            }

            const charNumberLabel = (totalChars > 0 && c < currentChunk.length)
                ? `CELL #${c + 1} [${startCharIdx + c}]`
                : `CELL #${c + 1}`;

            card.innerHTML = `
                <div class="cell-info">
                    <div class="cell-idx">${charNumberLabel}</div>
                    <div class="cell-char">${cell.char === ' ' ? '&nbsp;' : cell.char}</div>
                </div>
                <div class="cell-dots-grid">
                    ${dotsHTML}
                </div>
            `;
            gridContainer.appendChild(card);
        }
    }

    // 6. Power pulse status update simulation
    const pwr = document.getElementById('powerStatus');
    if (pwr) {
        pwr.innerText = '2.4W (ACTUATING PULSE)';
        pwr.style.color = 'var(--accent-emerald)';
        setTimeout(() => {
            if (pwr) {
                pwr.innerText = '0W (IDLE BISTABLE LATCH)';
                pwr.style.color = 'var(--accent-cyan)';
            }
        }, 600);
    }

    // 7. Sync 3D tactile buttons on the hardware model
    if (typeof update3DButtonsState === 'function') {
        update3DButtonsState();
    }
}

/**
 * Navigates to next Braille page
 */
function nextBraillePage() {
    if (currentBrailleChunks && currentBraillePageIndex < currentBrailleChunks.length - 1) {
        currentBraillePageIndex++;
        updatePaginationDisplay();
    }
}

/**
 * Navigates to previous Braille page
 */
function prevBraillePage() {
    if (currentBrailleChunks && currentBraillePageIndex > 0) {
        currentBraillePageIndex--;
        updatePaginationDisplay();
    }
}

/**
 * Main dispatcher to update Braille display with given text
 */
function updateBrailleDisplay(text) {
    if (text === undefined || text === null) {
        const inputEl = document.getElementById('thaiInput');
        text = inputEl ? inputEl.value : '';
    }

    currentBrailleFullText = text;
    currentBrailleChunks = chunkTextForBraille(text);

    if (currentBraillePageIndex >= currentBrailleChunks.length) {
        currentBraillePageIndex = 0;
    }

    updatePaginationDisplay();
}

/**
 * Toggles single language mode between Thai and English
 */
function toggleLanguageMode(forcedMode) {
    if (forcedMode === 'tha' || forcedMode === 'eng') {
        currentLanguageMode = forcedMode;
    } else {
        currentLanguageMode = (currentLanguageMode === 'eng') ? 'tha' : 'eng';
    }

    // 1. Update Dropdown #ocrLangSelect
    const langSelect = document.getElementById('ocrLangSelect');
    if (langSelect) {
        langSelect.value = currentLanguageMode;
    }

    // 2. Update Mode Button Text & Badge / Class
    const modeBtn = document.getElementById('btnToggleLanguageMode');
    if (modeBtn) {
        if (currentLanguageMode === 'eng') {
            modeBtn.className = 'tactical-mode-btn mode-eng';
            modeBtn.innerHTML = '<i class="fa-solid fa-right-left"></i> MODE: ENG [A-Z]';
            modeBtn.title = 'โหมดปัจจุบัน: English (eng) - คลิกเพื่อสลับเป็น ภาษาไทย';
        } else {
            modeBtn.className = 'tactical-mode-btn mode-thai';
            modeBtn.innerHTML = '<i class="fa-solid fa-right-left"></i> MODE: THAI [ก-ฮ]';
            modeBtn.title = 'โหมดปัจจุบัน: ภาษาไทย (tha) - คลิกเพื่อสลับเป็น English';
        }
    }

    // 3. Update Textarea Placeholder & Presets
    const inputEl = document.getElementById('thaiInput');
    const presetContainer = document.getElementById('presetContainer');
    if (inputEl) {
        if (currentLanguageMode === 'eng') {
            inputEl.placeholder = 'Enter English text or select a preset... (e.g. HELLO WORLD)';
        } else {
            inputEl.placeholder = 'ป้อนข้อความภาษาไทย หรือเลือกข้อความสำเร็จรูป...';
        }
    }

    if (presetContainer) {
        if (currentLanguageMode === 'eng') {
            presetContainer.innerHTML = `
                <div class="preset-chip" onclick="setPreset('HELLO WORLD')">HELLO WORLD</div>
                <div class="preset-chip" onclick="setPreset('WELCOME TO BRAILLLENS')">WELCOME TO BRAILLLENS</div>
                <div class="preset-chip" onclick="setPreset('TACTILE 84 PINS')">TACTILE 84 PINS</div>
                <div class="preset-chip" onclick="setPreset('INNOVATION')">INNOVATION</div>
            `;
        } else {
            presetContainer.innerHTML = `
                <div class="preset-chip" onclick="setPreset('สวัสดีครับ')">สวัสดีครับ</div>
                <div class="preset-chip" onclick="setPreset('ยินดีต้อนรับ')">ยินดีต้อนรับ</div>
                <div class="preset-chip" onclick="setPreset('BraillLens')">BraillLens</div>
                <div class="preset-chip" onclick="setPreset('การเรียนรู้อักษรเบรลล์')">การเรียนรู้อักษรเบรลล์</div>
            `;
        }
    }

    // 4. Update display and flash feedback
    updatePaginationDisplay();
}

/**
 * Triggers manual translation processing
 */
function processTranslation() {
    const inputEl = document.getElementById('thaiInput');
    const text = inputEl ? inputEl.value : '';
    updateBrailleDisplay(text);
}

/**
 * Sets predefined preset text
 */
function setPreset(text) {
    const inputEl = document.getElementById('thaiInput');
    if (inputEl) inputEl.value = text;
    updateBrailleDisplay(text);
}

/**
 * Highlights 2D card and focuses 3D camera onto selected cell
 */
function selectCellCard(cIdx) {
    document.querySelectorAll('.cell-card').forEach(el => el.classList.remove('selected'));
    const card = document.getElementById(`cell-card-${cIdx}`);
    if (card) card.classList.add('selected');

    if (typeof cellGroups !== 'undefined' && cellGroups[cIdx]) {
        const cellGroup = cellGroups[cIdx];
        const targetX = cellGroup.position.x;
        if (typeof controls !== 'undefined' && controls) {
            controls.target.set(targetX, 0, 1.4);
        }
        if (typeof camera !== 'undefined' && camera) {
            camera.position.set(targetX, 3.8, 5.2);
        }
    }
}
