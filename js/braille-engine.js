/* =========================================================================
   BraillLens 3D & Optical OCR System - Braille Translation & Pagination Engine
   Version: 3.1.0 (Modular Braille Core)
   ========================================================================= */

/* The Thai/English character -> braille dot tables now live in
   js/thai-braille-tables.js (single source of truth) and are consumed by the
   transliteration engine in js/thai-braille.js. This file only orchestrates
   the DOM + 84-pin hardware model. */

// Global Translation & Pagination States
let currentText = 'HELLO WORLD';
let currentBrailleChunks = [];   // Page[] : { cells: Cell[], text: string }
let currentBraillePageIndex = 0;
let currentBrailleFullText = 'HELLO WORLD';
let currentLanguageMode = 'eng';

/**
 * Converts text to Braille CELLS via the Thai Braille engine (js/thai-braille.js).
 * Returns a VARIABLE-length array of cells: { dots, source, kind, char, activeDots }.
 * (`char`/`activeDots` are back-compat aliases of `source`/`dots`.)
 */
function textToCells(text) {
    if (typeof textToBrailleCells === 'function') {
        return textToBrailleCells(text);
    }
    // Defensive fallback if the engine failed to load - blank cells.
    return Array.from(text || '').map(ch => ({
        dots: [], source: ch, kind: 'unknown', char: ch, activeDots: []
    }));
}

/**
 * DEPRECATED shim: legacy callers that still expect exactly 14 fixed cells.
 * New code should use textToCells() + paginateBrailleCells().
 */
function convertThaiToBraille(text) {
    const produced = textToCells(text);
    const cells = [];
    for (let c = 0; c < 14; c++) {
        const src = produced[c];
        const activeDots = src ? src.dots : [];
        cells.push({
            char: src ? src.source : ' ',
            source: src ? src.source : ' ',
            activeDots: activeDots,
            dots: activeDots,
            dotsBool: [1, 2, 3, 4, 5, 6].map(dot => activeDots.includes(dot))
        });
    }
    return cells;
}

/**
 * Splits arbitrary-length text into Braille PAGES of 14 cells each.
 * Returns Page[] where Page = { cells: Cell[], text: string }.
 * NOTE: pages are keyed by braille-cell count, not input-character count -
 * one Thai syllable can span several cells.
 */
function chunkTextForBraille(text) {
    if (typeof paginateBrailleCells === 'function') {
        return paginateBrailleCells(textToCells(text), 14);
    }
    return [{ cells: [], text: String(text || '') }];
}

/**
 * Updates UI pagination buttons, badge, OLED texture, 3D pins, and 2D matrix cards
 */
function updatePaginationDisplay() {
    if (!currentBrailleChunks || currentBrailleChunks.length === 0) {
        currentBrailleChunks = [{ cells: [], text: '' }];
    }

    const totalPages = Math.max(1, currentBrailleChunks.length);
    if (currentBraillePageIndex < 0) currentBraillePageIndex = 0;
    if (currentBraillePageIndex >= totalPages) currentBraillePageIndex = totalPages - 1;

    const currentPage = currentBraillePageIndex + 1;
    // A page is { cells: Cell[], text: string }. Tolerate a bare string too
    // (legacy callers that assign currentBrailleChunks directly).
    let page = currentBrailleChunks[currentBraillePageIndex];
    if (typeof page === 'string') page = { cells: textToCells(page), text: page };
    if (!page) page = { cells: [], text: '' };
    const pageCells = page.cells || [];
    const currentChunk = page.text || '';

    // Running braille-CELL offset of this page (not character offset).
    let cellsBeforePage = 0;
    for (let p = 0; p < currentBraillePageIndex; p++) {
        const pc = currentBrailleChunks[p];
        cellsBeforePage += (pc && pc.cells) ? pc.cells.length : 0;
    }
    const totalCells = currentBrailleChunks.reduce(
        (n, pc) => n + ((pc && pc.cells) ? pc.cells.length : 0), 0);
    const startCellIdx = totalCells === 0 ? 0 : cellsBeforePage + 1;

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

    // 3. Braille cells for the current page (variable count, <= 14)
    const cellsData = pageCells;
    const dotOrder = [1, 4, 2, 5, 3, 6];

    // 4. Update 3D target array for 84 pins (hardware is fixed 14 cells x 6)
    if (typeof pinTargetY !== 'undefined' && typeof pinTargetCamAngle !== 'undefined') {
        for (let c = 0; c < 14; c++) {
            const cell = cellsData[c] || { dots: [] };
            const dots = cell.dots || cell.activeDots || [];
            for (let k = 0; k < 6; k++) {
                const dotNum = dotOrder[k];
                const isActive = dots.includes(dotNum);
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
            const cell = cellsData[c] || { dots: [], source: '' };
            const dots = cell.dots || cell.activeDots || [];
            const src = (cell.source !== undefined ? cell.source : cell.char) || '';
            const card = document.createElement('div');
            card.className = 'cell-card';
            card.id = `cell-card-${c}`;
            card.onclick = () => selectCellCard(c);

            let dotsHTML = '';
            for (let d of dotOrder) {
                const act = dots.includes(d) ? 'active' : '';
                dotsHTML += `<div class="dot-pin ${act}"></div>`;
            }

            const hasCell = c < cellsData.length;
            const charNumberLabel = hasCell
                ? `CELL #${c + 1} [${startCellIdx + c}]`
                : `CELL #${c + 1}`;
            const charLabel = (src === '' || src === ' ') ? '&nbsp;' : src;

            card.innerHTML = `
                <div class="cell-info">
                    <div class="cell-idx">${charNumberLabel}</div>
                    <div class="cell-char">${charLabel}</div>
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
