/* =========================================================================
   BraillLens 3D & Optical OCR System - Application Entry Point
   Version: 4.0.0 (2-Cell ESP32 Tactile Workstation Integration)
   ========================================================================= */

/**
 * Restores saved theme (dark / light) from localStorage
 */
function restoreSavedTheme() {
    let savedTheme = 'dark';
    try {
        savedTheme = localStorage.getItem('braillens-theme') || 'dark';
    } catch (e) {}

    if (savedTheme === 'light') {
        if (typeof isLightMode !== 'undefined') isLightMode = true;
        document.body.classList.add('light-mode');
        const btn = document.getElementById('lightModeBtn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-moon"></i> 🌙 โหมดมืด (Dark Mode)';
        }
    }
}

// Restore saved theme immediately upon script load
restoreSavedTheme();

// Global workstation instances
let esp32Serial = null;
let twoCellEngine = null;
let tactileShapesMgr = null;

/**
 * Initialize 2-Cell ESP32 Workstation
 */
function initTwoCellWorkstation() {
    // 1. ESP32 Serial Manager
    if (typeof ESP32SerialManager !== 'undefined') {
        esp32Serial = window.esp32Serial || new ESP32SerialManager();
        window.esp32Serial = esp32Serial;

        const badgeEl = document.getElementById('esp32StatusBadge');
        const connectBtn = document.getElementById('btnConnectESP32');
        const portDescEl = document.getElementById('esp32PortDesc');
        const lastTxEl = document.getElementById('esp32LastTx');

        // Serial event handlers
        esp32Serial.on('status', (data) => {
            if (badgeEl) {
                if (data.connected) {
                    badgeEl.className = 'esp32-status-badge connected';
                    badgeEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> เชื่อมต่อแล้ว';
                    if (connectBtn) connectBtn.innerHTML = '<i class="fa-solid fa-link-slash"></i> ตัดการเชื่อมต่อ';
                } else if (data.connecting) {
                    badgeEl.className = 'esp32-status-badge connecting';
                    badgeEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเชื่อมต่อ...';
                } else {
                    badgeEl.className = 'esp32-status-badge';
                    badgeEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ออฟไลน์ (จำลอง)';
                    if (connectBtn) connectBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> เชื่อมต่อ ESP32';
                }
            }
            if (portDescEl && data.portDesc) {
                portDescEl.textContent = data.portDesc;
            }
        });

        esp32Serial.on('tx', (data) => {
            if (lastTxEl) {
                lastTxEl.textContent = data.command;
            }
        });

        // Connect button click
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                if (esp32Serial.isConnected) {
                    esp32Serial.disconnect();
                } else {
                    esp32Serial.requestPort();
                }
            });
        }

        // Auto-connect on page load (silently checks previously authorized ports)
        esp32Serial.autoConnect();
    }

    // 2. Two-Cell Display & Full-Text Ribbon Engine
    if (typeof TwoCellDisplayEngine !== 'undefined') {
        twoCellEngine = new TwoCellDisplayEngine({
            serialManager: esp32Serial,
            ribbonContainerId: 'textRibbonTrack',
            twoCellContainerId: 'twoCellTactileBoard',
            frameIndicatorId: 'frameCounterBadge',
            bitstringDisplayId: 'activeBitstringDisplay'
        });
        window.twoCellEngine = twoCellEngine;

        // Synchronize with Main Text Input
        const mainInput = document.getElementById('mainTextInput');
        const submitBtn = document.getElementById('btnSubmitTextInput');
        const legacyInput = document.getElementById('thaiInput');

        let typingDebounceTimer = null;

        const handleTextChange = (val) => {
            if (twoCellEngine) twoCellEngine.setText(val);
            if (legacyInput && legacyInput.value !== val) {
                legacyInput.value = val;
                if (typeof updateBrailleDisplay === 'function') {
                    updateBrailleDisplay(val);
                }
            }
        };

        if (mainInput) {
            // Explicit Submit on button click
            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    clearTimeout(typingDebounceTimer);
                    handleTextChange(mainInput.value);
                });
            }

            // Submit immediately on Enter key
            mainInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(typingDebounceTimer);
                    handleTextChange(mainInput.value);
                }
            });

            // On change (blur / committed input)
            mainInput.addEventListener('change', (e) => {
                clearTimeout(typingDebounceTimer);
                handleTextChange(e.target.value);
            });

            // Smooth debounce while typing: waits until user pauses for 700ms so incomplete words aren't cut
            mainInput.addEventListener('input', (e) => {
                clearTimeout(typingDebounceTimer);
                typingDebounceTimer = setTimeout(() => {
                    handleTextChange(e.target.value);
                }, 700);
            });
        }

        // Navigation buttons
        const prevBtn = document.getElementById('btnPrevCellPair');
        const nextBtn = document.getElementById('btnNextCellPair');
        const playBtn = document.getElementById('btnToggleAutoPlay');
        const pulseBtn = document.getElementById('btnPulseActuate');
        const speedSlider = document.getElementById('playSpeedSlider');
        const speedValLabel = document.getElementById('speedValLabel');

        if (prevBtn) prevBtn.addEventListener('click', () => twoCellEngine.prevFrame());
        if (nextBtn) nextBtn.addEventListener('click', () => twoCellEngine.nextFrame());
        if (playBtn) playBtn.addEventListener('click', () => twoCellEngine.toggleAutoPlay());
        if (pulseBtn) {
            pulseBtn.addEventListener('click', () => {
                twoCellEngine.triggerPulseActuation();
            });
        }
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const val = Number(e.target.value);
                twoCellEngine.setSpeed(val * 1000);
                if (speedValLabel) speedValLabel.textContent = `${val.toFixed(1)}s`;
            });
        }

        // Initial text (load from Camera OCR / Image Upload persistence if available)
        let initialText = 'รับเหมาก่อเรื่อง';
        if (typeof localStorage !== 'undefined') {
            const lastOcr = localStorage.getItem('braillend_last_ocr_text');
            if (lastOcr && lastOcr.trim() && lastOcr !== 'กันต์กวี' && lastOcr !== 'สวัสดี') {
                initialText = lastOcr.trim();
            }
        }
        if (mainInput) mainInput.value = initialText;
        if (legacyInput) legacyInput.value = initialText;
        twoCellEngine.setText(initialText);

        // Realtime cross-tab storage listener
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === 'braillend_last_ocr_text' && e.newValue && e.newValue.trim()) {
                    const txt = e.newValue.trim();
                    if (mainInput) mainInput.value = txt;
                    twoCellEngine.setText(txt);
                    if (legacyInput) legacyInput.value = txt;
                    if (typeof updateBrailleDisplay === 'function') updateBrailleDisplay(txt);
                }
            });
        }
    }

    // 3. Tactile Shapes Manager
    if (typeof TactileShapesManager !== 'undefined') {
        tactileShapesMgr = window.tactileShapes || new TactileShapesManager();
        window.tactileShapesMgr = tactileShapesMgr;

        renderTactileShapesModal();
    }
}

/**
 * Render Tactile Shapes Presets & 12-Dot Custom Matrix inside Modal
 */
function renderTactileShapesModal() {
    const gridEl = document.getElementById('shapesPresetGrid');
    if (!gridEl || !tactileShapesMgr) return;

    gridEl.innerHTML = '';
    tactileShapesMgr.presets.forEach(p => {
        const card = document.createElement('div');
        card.className = `shape-btn-card ${(tactileShapesMgr.currentShape && tactileShapesMgr.currentShape.id === p.id) ? 'active' : ''}`;
        card.id = `shape-card-${p.id.replace('.', '-')}`;
        card.title = `${p.name}: ${p.description}`;
        card.innerHTML = `
            <div class="shape-symbol-large">${p.symbol}</div>
            <div class="shape-name-tag">${p.id} ${p.name}</div>
            <div class="shape-dots-tag">จุด: ${p.dots.join(', ')}</div>
        `;
        card.addEventListener('click', () => {
            selectTactileShape(p.id);
        });
        gridEl.appendChild(card);
    });

    renderCustom12DotClicker();
}

/**
 * Handle Shape selection
 */
function selectTactileShape(id) {
    if (!tactileShapesMgr) return;
    const res = tactileShapesMgr.selectPreset(id);
    if (res && res.preset) {
        // Highlight active shape card
        document.querySelectorAll('.shape-btn-card').forEach(c => c.classList.remove('active'));
        const activeCard = document.getElementById(`shape-card-${id.replace('.', '-')}`);
        if (activeCard) activeCard.classList.add('active');

        // Sync custom dots clicker with this shape's dots
        tactileShapesMgr.customDots = new Set(res.preset.dots);
        renderCustom12DotClicker();

        if (esp32Serial) esp32Serial.send12BitCommand(res.bitstring);
        // Also update 2-cell visual twin
        displayDirect12Bits(res.bitstring, `${res.preset.symbol} ${res.preset.name}`);
    }
}

/**
 * Render 3x4 Clicker Matrix for Custom 12 Dots
 */
function renderCustom12DotClicker() {
    const clickerEl = document.getElementById('customMatrixClicker');
    if (!clickerEl || !tactileShapesMgr) return;

    const pinOrder = [
        [1, 4, 7, 10],
        [2, 5, 8, 11],
        [3, 6, 9, 12]
    ];

    let html = '';
    for (let r = 0; r < 3; r++) {
        html += '<div style="display:flex; gap:12px; justify-content:center;">';
        for (let c = 0; c < 4; c++) {
            const dotNum = pinOrder[r][c];
            const isActive = tactileShapesMgr.customDots.has(dotNum);
            html += `<button class="clicker-dot-btn ${isActive ? 'active' : ''}" onclick="toggleCustomDotClick(${dotNum})">${dotNum}</button>`;
        }
        html += '</div>';
    }
    clickerEl.innerHTML = html;
}

function toggleCustomDotClick(dotNum) {
    if (!tactileShapesMgr) return;
    const res = tactileShapesMgr.toggleCustomDot(dotNum);
    
    // De-highlight preset cards if custom configuration
    document.querySelectorAll('.shape-btn-card').forEach(c => c.classList.remove('active'));

    renderCustom12DotClicker();
    if (res && res.bitstring) {
        if (esp32Serial) esp32Serial.send12BitCommand(res.bitstring);
        displayDirect12Bits(res.bitstring, 'จุดสัมผัสกำหนดเอง');
    }
}

function clearCustomDots() {
    if (!tactileShapesMgr) return;
    tactileShapesMgr.clearCustomDots();
    document.querySelectorAll('.shape-btn-card').forEach(c => c.classList.remove('active'));
    renderCustom12DotClicker();
    const zeroBits = "000000000000";
    if (esp32Serial) esp32Serial.send12BitCommand(zeroBits);
    displayDirect12Bits(zeroBits, 'ล้างจุดทั้งหมด');
}

/**
 * Update 2-cell twin with a direct 12-bit string (from shapes or test diagnostics)
 */
function displayDirect12Bits(bits12, label = '') {
    const container = document.getElementById('twoCellTactileBoard');
    if (!container) return;

    const pinOrder = [
        [1, 4, 7, 10],
        [2, 5, 8, 11],
        [3, 6, 9, 12]
    ];

    let gridHtml = '<div class="tactile-matrix-grid">';
    for (let row = 0; row < 3; row++) {
        gridHtml += '<div class="tactile-row">';
        for (let col = 0; col < 4; col++) {
            const pinNum = pinOrder[row][col];
            const isRaised = (bits12[pinNum - 1] === '1');
            const cellGroup = pinNum <= 6 ? 'c1' : 'c2';

            gridHtml += `
                <div class="tactile-pin-wrap ${cellGroup}">
                    <div class="tactile-pin ${isRaised ? 'raised' : 'recessed'}" id="pin-${pinNum}" title="หมุดที่ ${pinNum} - ${isRaised ? 'ดันขึ้น (1)' : 'ยุบตัว (0)'}">
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

    const bitEl = document.getElementById('activeBitstringDisplay');
    if (bitEl) {
        const c1 = bits12.substring(0, 6);
        const c2 = bits12.substring(6, 12);
        bitEl.innerHTML = `<span class="bit-chunk c1">${c1}</span> <span class="bit-chunk c2">${c2}</span> <span style="font-size:11px; color:#f59e0b; margin-left:8px;">[${label}]</span>`;
    }
}

/**
 * Load Quick Preset Word
 */
function loadQuickWord(word) {
    const mainInput = document.getElementById('mainTextInput');
    if (mainInput) {
        mainInput.value = word;
        if (twoCellEngine) twoCellEngine.setText(word);
    }
}

/**
 * Mobile Sidebar Drawer Toggle & Backdrop Handlers
 */
function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const icon = document.getElementById('hamburgerIcon');
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
        if (isOpen) backdrop.classList.add('active');
        else backdrop.classList.remove('active');
    }
    if (icon) {
        icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const icon = document.getElementById('hamburgerIcon');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    if (icon) icon.className = 'fa-solid fa-bars';
}

/**
 * Workstation Tab Navigation & Embedded View Toggles
 */
function setWorkstationTab(tab) {
    // Auto close mobile sidebar drawer on selection
    closeMobileSidebar();

    const wrap = document.getElementById('workstationContentWrap');
    if (wrap) wrap.style.display = 'flex';
    const dock = document.getElementById('legacyFloatingDock');
    if (dock) dock.style.display = 'none';

    // 1. Update sidebar menu highlights
    const sidebarMap = {
        'text': 'menuLiveText',
        'shapes': 'menuShapes',
        'diag': 'menuDiag',
        'upload': 'menuUpload'
    };
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    const activeBtn = document.getElementById(sidebarMap[tab] || 'menuLiveText');
    if (activeBtn) activeBtn.classList.add('active');

    // 2. Switch interactive cards
    const allCards = ['tabCardText', 'tabCardShapes', 'tabCardDiag', 'tabCardUpload'];
    allCards.forEach(cardId => {
        const el = document.getElementById(cardId);
        if (el) el.style.display = 'none';
    });

    const targetCardMap = {
        'text': 'tabCardText',
        'shapes': 'tabCardShapes',
        'diag': 'tabCardDiag',
        'upload': 'tabCardUpload'
    };
    const targetEl = document.getElementById(targetCardMap[tab] || 'tabCardText');
    if (targetEl) targetEl.style.display = 'flex';

    // 3. If shapes tab, re-render shapes presets grid and custom clicker
    if (tab === 'shapes' && typeof renderTactileShapesModal === 'function') {
        renderTactileShapesModal();
    }
}

function openTactileShapesModal() {
    setWorkstationTab('shapes');
}

function closeTactileShapesModal() {
    setWorkstationTab('text');
}

function openPinDiagnosticModal() {
    setWorkstationTab('diag');
}

function closePinDiagnosticModal() {
    setWorkstationTab('text');
}

function openImageUploadModal() {
    setWorkstationTab('upload');
}

function closeImageUploadModal() {
    setWorkstationTab('text');
}

function testSinglePin(pinNum) {
    const bits = new Array(12).fill('0');
    if (pinNum >= 1 && pinNum <= 12) bits[pinNum - 1] = '1';
    const bitstring = bits.join('');
    if (esp32Serial) esp32Serial.send12BitCommand(bitstring);
    displayDirect12Bits(bitstring, `ทดสอบหมุดที่ ${pinNum} (2 วิ)`);

    // Auto cutoff after 2 seconds
    setTimeout(() => {
        const zeroBits = '000000000000';
        if (esp32Serial) esp32Serial.send12BitCommand(zeroBits);
        displayDirect12Bits(zeroBits, 'ตัดไฟ (พักหมุด)');
    }, 2000);
}

function testL298NDriver(driverIdx) {
    const bits = new Array(12).fill('0');
    let label = '';
    if (driverIdx === 1) {
        // Pins 1-4
        for (let i = 0; i < 4; i++) bits[i] = '1';
        label = 'L298N #1 (จุด 1-4)';
    } else if (driverIdx === 2) {
        // Pins 5-8
        for (let i = 4; i < 8; i++) bits[i] = '1';
        label = 'L298N #2 (จุด 5-8)';
    } else if (driverIdx === 3) {
        // Pins 9-12
        for (let i = 8; i < 12; i++) bits[i] = '1';
        label = 'L298N #3 (จุด 9-12)';
    }
    const bitstring = bits.join('');
    if (esp32Serial) esp32Serial.send12BitCommand(bitstring);
    displayDirect12Bits(bitstring, `${label} (2 วิ)`);

    // Auto cutoff after 2 seconds
    setTimeout(() => {
        const zeroBits = '000000000000';
        if (esp32Serial) esp32Serial.send12BitCommand(zeroBits);
        displayDirect12Bits(zeroBits, 'ตัดไฟ (พักหมุด)');
    }, 2000);
}

/**
 * OCR Flow Modal & Pending Image Processor (Camera -> Index Redirect)
 */
let activeFlowOcrText = '';
let activeFlowConfidence = 95;

function dataUrlToBlob(dataUrl) {
    try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.warn('dataUrlToBlob error:', e);
        return null;
    }
}

async function triggerOcrFlowModal(fileOrBlob, source = 'upload') {
    const modal = document.getElementById('ocrFlowModal');
    const loadingState = document.getElementById('ocrFlowLoadingState');
    const summaryState = document.getElementById('ocrFlowSummaryState');
    if (!modal) return;

    // 1. Show spinning loading state
    modal.classList.add('active');
    if (loadingState) loadingState.style.display = 'flex';
    if (summaryState) summaryState.style.display = 'none';

    let result = null;
    try {
        if (typeof recognize === 'function') {
            result = await recognize(fileOrBlob, source);
        }
    } catch (err) {
        console.warn('OCR execution failed:', err);
    }

    let rawText = (result && typeof result.text === 'string') ? result.text.trim() : '';
    if (typeof normalizeOcrText === 'function' && rawText) {
        rawText = normalizeOcrText(rawText);
    }
    const conf = (result && typeof result.confidence === 'number') ? Math.round(result.confidence) : 90;
    const words = (result && Array.isArray(result.words)) ? result.words : [];

    activeFlowOcrText = rawText;
    activeFlowConfidence = conf;

    // 2. Populate Summary State UI
    const detectedBox = document.getElementById('ocrFlowDetectedText');
    const confBadge = document.getElementById('ocrFlowConfBadge');
    const wordCountEl = document.getElementById('ocrFlowWordCount');
    const brailleCountEl = document.getElementById('ocrFlowBrailleCount');
    const engineTypeEl = document.getElementById('ocrFlowEngineType');
    const healthTextEl = document.getElementById('ocrFlowHealthText');

    if (detectedBox) {
        detectedBox.textContent = rawText ? `"${rawText}"` : 'ไม่พบข้อความในภาพ';
        detectedBox.style.color = rawText ? '#00ff88' : '#ef4444';
    }

    if (confBadge) {
        confBadge.textContent = `ความแม่นยำ ${conf}%`;
    }

    if (wordCountEl) {
        const wCount = words.length > 0 ? words.length : (rawText ? rawText.split(/\s+/).length : 0);
        wordCountEl.textContent = `${wCount} คำ`;
    }

    if (brailleCountEl) {
        let cellCount = 0;
        if (typeof textToBrailleCells === 'function' && rawText) {
            cellCount = textToBrailleCells(rawText).length;
        } else if (rawText) {
            cellCount = rawText.length;
        }
        brailleCountEl.textContent = `${cellCount} เซลล์`;
    }

    if (engineTypeEl) {
        engineTypeEl.textContent = (result && result.engine === 'tesseract') ? 'Tesseract' : 'EasyOCR';
    }

    if (healthTextEl) {
        const health = conf >= 72 ? 'ชัดเจน' : (conf >= 45 ? 'อาจมีคำผิด' : 'ไม่ชัดเจน');
        healthTextEl.textContent = health;
        healthTextEl.style.color = conf >= 72 ? '#00ff88' : (conf >= 45 ? '#f59e0b' : '#ef4444');
    }

    // 3. Switch to Summary View
    if (loadingState) loadingState.style.display = 'none';
    if (summaryState) summaryState.style.display = 'flex';
}

function confirmOcrFlowResult() {
    const modal = document.getElementById('ocrFlowModal');
    if (modal) modal.classList.remove('active');

    // Remove pending storage items
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('braillend_pending_ocr_image');
        sessionStorage.removeItem('braillend_pending_ocr_source');
    }

    if (activeFlowOcrText) {
        const mainInput = document.getElementById('mainTextInput');
        const legacyInput = document.getElementById('thaiInput');

        if (mainInput) mainInput.value = activeFlowOcrText;
        if (legacyInput) legacyInput.value = activeFlowOcrText;

        if (twoCellEngine && typeof twoCellEngine.setText === 'function') {
            twoCellEngine.setText(activeFlowOcrText);
        }

        if (typeof updateBrailleDisplay === 'function') {
            updateBrailleDisplay(activeFlowOcrText);
        }

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('braillend_last_ocr_text', activeFlowOcrText);
            } catch (e) {}
        }
    }
}

function speakFlowResult() {
    if ('speechSynthesis' in window && activeFlowOcrText) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(activeFlowOcrText);
        utter.lang = 'th-TH';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
    }
}

function stopSpeakingFlowResult() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

function checkPendingOcr() {
    if (typeof sessionStorage === 'undefined') return;
    const pendingImage = sessionStorage.getItem('braillend_pending_ocr_image');
    const pendingSource = sessionStorage.getItem('braillend_pending_ocr_source') || 'camera';

    // Clean query param from URL
    if (typeof window !== 'undefined' && window.location.search.includes('ocr=pending')) {
        try {
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
    }

    if (pendingImage) {
        const blob = dataUrlToBlob(pendingImage);
        if (blob) {
            triggerOcrFlowModal(blob, pendingSource);
        }
    }
}

// Initialize all subsystems when DOM content is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize 2-Cell ESP32 Tactile Workstation (PRIMARY FOR INDEX.HTML)
    try {
        initTwoCellWorkstation();
    } catch (e) {
        console.error('[TwoCellWorkstation Error]:', e);
    }

    // 2. Initialize 3D WebGL Scene & Controls (only if webgl-container is present)
    const webglBox = document.getElementById('webgl-container');
    if (webglBox && typeof initMain3D === 'function') {
        try {
            initMain3D();
            if (typeof applyThemeToScene === 'function') applyThemeToScene();
            if (typeof updateScreenCanvas === 'function') updateScreenCanvas("HELLO WORLD");
        } catch (e) {
            console.warn('[3D Init skipped]:', e);
        }
    }

    // 3. Bind Input Textarea Events
    const inputEl = document.getElementById('thaiInput');
    if (inputEl) {
        ['input', 'change', 'keyup'].forEach(evt => {
            inputEl.addEventListener(evt, (e) => {
                if (typeof updateBrailleDisplay === 'function') {
                    updateBrailleDisplay(e.target.value);
                }
            });
        });
    }

    // 4. Initial Braille Actuation (Legacy 14-cell)
    if (typeof updateBrailleDisplay === 'function') {
        try {
            updateBrailleDisplay();
        } catch (e) {
            console.warn('[updateBrailleDisplay skipped]:', e);
        }
    }

    // 5. Bind OCR, Camera, and Tactile Navigation Handlers
    if (typeof initOCRHandlers === 'function') {
        try {
            initOCRHandlers();
        } catch (e) {
            console.warn('[OCR Handlers skipped]:', e);
        }
    }

    // 6. Check for Pending Camera / Upload OCR on Page Load
    setTimeout(() => {
        checkPendingOcr();
    }, 150);
});

// Explicit window bindings for modal interactions
if (typeof window !== 'undefined') {
    window.openTactileShapesModal = openTactileShapesModal;
    window.closeTactileShapesModal = closeTactileShapesModal;
    window.openPinDiagnosticModal = openPinDiagnosticModal;
    window.closePinDiagnosticModal = closePinDiagnosticModal;
    window.openImageUploadModal = openImageUploadModal;
    window.closeImageUploadModal = closeImageUploadModal;
    window.selectTactileShape = selectTactileShape;
    window.toggleCustomDotClick = toggleCustomDotClick;
    window.clearCustomDots = clearCustomDots;
    window.testSinglePin = testSinglePin;
    window.testL298NDriver = testL298NDriver;
    window.loadQuickWord = loadQuickWord;
    window.displayDirect12Bits = displayDirect12Bits;
    window.triggerOcrFlowModal = triggerOcrFlowModal;
    window.confirmOcrFlowResult = confirmOcrFlowResult;
    window.speakFlowResult = speakFlowResult;
    window.stopSpeakingFlowResult = stopSpeakingFlowResult;
    window.checkPendingOcr = checkPendingOcr;
    window.toggleMobileSidebar = toggleMobileSidebar;
    window.closeMobileSidebar = closeMobileSidebar;
}
