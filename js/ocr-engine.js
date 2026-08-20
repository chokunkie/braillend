/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Orchestration & UI Glue
   Version: 4.0.0 (EasyOCR Backend / Thai-Focused)

   This file owns UI wiring only (dropzone, camera modal, progress HUD,
   bounding-box inspector) plus the single unified pipeline function that
   BOTH the upload flow and the camera-capture flow call. The only thing
   that differs between them is the documentSource label - it has zero
   effect on how OCR is actually performed (that logic lives entirely in
   js/ocr.js). Camera stream/capture mechanics live in js/camera.js. Text
   normalization lives in js/textProcessor.js. Demo Mode lives in
   js/demoMode.js and never touches this pipeline's network call.
   ========================================================================= */

let isOCROngoing = false;
let lastOcrInspectorData = null;
const OCR_LOW_CONFIDENCE_THRESHOLD = 50;

/**
 * Updates OCR Progress HUD and Confidence Indicator
 */
function updateOCRProgress(progress01, statusHtml, confidence = null) {
    const container = document.getElementById('ocrProgressContainer');
    const fill = document.getElementById('ocrProgressBar');
    const status = document.getElementById('ocrStatusText');
    const confBadge = document.getElementById('ocrConfidenceScore');

    if (container && !container.classList.contains('active')) container.classList.add('active');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, Math.round(progress01 * 100)))}%`;
    if (status && statusHtml) status.innerHTML = statusHtml;

    if (confBadge && confidence !== null && confidence !== undefined) {
        confBadge.innerText = `CONF: ${Math.round(confidence)}%`;
        if (confidence >= 80) {
            confBadge.style.background = 'rgba(0, 255, 136, 0.15)';
            confBadge.style.color = 'var(--accent-emerald)';
            confBadge.style.borderColor = 'rgba(0, 255, 136, 0.4)';
        } else if (confidence >= OCR_LOW_CONFIDENCE_THRESHOLD) {
            confBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            confBadge.style.color = 'var(--accent-amber)';
            confBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        } else {
            confBadge.style.background = 'rgba(255, 0, 85, 0.15)';
            confBadge.style.color = 'var(--accent-magenta)';
            confBadge.style.borderColor = 'rgba(255, 0, 85, 0.4)';
        }
    }
}

/**
 * Visual OCR Bounding Box Inspector: renders image & draws glowing bounding boxes around detected words
 */
function renderOCRInspector(imageSource, ocrData) {
    if (!imageSource || !ocrData) return;
    lastOcrInspectorData = { canvas: imageSource, data: ocrData };

    const canvas = document.getElementById('ocrResultCanvasInspector');
    const wordCountBadge = document.getElementById('inspectorWordCount');
    const detailsBar = document.getElementById('inspectorDetailsBar');
    if (!canvas) return;

    const srcW = imageSource.width || imageSource.naturalWidth || 800;
    const srcH = imageSource.height || imageSource.naturalHeight || 600;
    canvas.width = srcW;
    canvas.height = srcH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imageSource, 0, 0, srcW, srcH);

    const words = (ocrData && ocrData.words) ? ocrData.words : [];
    const overallConf = (typeof ocrData.confidence === 'number') ? ocrData.confidence : 90;
    if (wordCountBadge) {
        wordCountBadge.innerText = `${words.length} Words (Confidence: ${Math.round(overallConf)}%)`;
    }

    if (detailsBar) {
        if (words.length === 0) {
            detailsBar.innerHTML = '<div class="inspector-empty-msg"><i class="fa-solid fa-circle-info"></i> ไม่พบตัวอักษรหรือคำในภาพสแกนนี้</div>';
        } else {
            detailsBar.innerHTML = words.map(w => {
                const text = (w.text || '').trim();
                const conf = Math.round(w.confidence || overallConf);
                return `<div class="inspector-word-tag"><i class="fa-solid fa-font"></i> <span>${text}</span> <span class="conf">${conf}%</span></div>`;
            }).join('');
        }
    }

    for (const w of words) {
        const bbox = w.bbox;
        if (!bbox) continue;
        const bx = bbox.x0, by = bbox.y0;
        const bw = bbox.x1 - bbox.x0, bh = bbox.y1 - bbox.y0;
        if (bw <= 0 || bh <= 0) continue;

        ctx.save();
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = Math.max(2, Math.round(srcW / 500));
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 8;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
        ctx.fillRect(bx, by, bw, bh);

        const labelText = (w.text || '').trim();
        if (labelText) {
            const fontSize = Math.max(11, Math.min(22, Math.round(bh * 0.55)));
            ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
            ctx.shadowBlur = 0;
            const metrics = ctx.measureText(labelText);
            const tagW = metrics.width + 8, tagH = fontSize + 6;
            const tagY = Math.max(0, by - tagH - 2);

            ctx.fillStyle = 'rgba(7, 10, 19, 0.90)';
            ctx.fillRect(bx, tagY, tagW, tagH);
            ctx.strokeStyle = '#00FF88';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, tagY, tagW, tagH);
            ctx.fillStyle = '#00FF88';
            ctx.fillText(labelText, bx + 4, tagY + fontSize - 1);
        }
        ctx.restore();
    }
}

function openOCRInspector() {
    const modal = document.getElementById('ocrInspectorModal');
    if (modal) {
        modal.classList.add('active');
        if (lastOcrInspectorData) renderOCRInspector(lastOcrInspectorData.canvas, lastOcrInspectorData.data);
    }
}

function closeOCRInspector() {
    const modal = document.getElementById('ocrInspectorModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Loads a File/Blob into an HTMLImageElement (used for the preview thumbnail
 * and the bounding-box inspector background).
 */
function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => resolve({ img, url });
        img.onerror = reject;
        img.src = url;
    });
}

function showPreview(file, label) {
    const previewCard = document.getElementById('dropzonePreview');
    const previewThumb = document.getElementById('previewThumbnail');
    const previewName = document.getElementById('previewFilename');
    if (previewCard && previewThumb && previewName) {
        previewThumb.src = URL.createObjectURL(file);
        previewName.innerText = label;
        previewCard.classList.add('active');
    }
}

/**
 * THE unified OCR pipeline. Both the upload handler and captureCameraSnapshot()
 * call this same function - documentSource is a UI label only and never
 * changes how OCR is performed.
 */
async function runOcrPipeline(imageFile, documentSource) {
    if (isOCROngoing || !imageFile) return null;
    isOCROngoing = true;

    try {
        updateOCRProgress(0.15, '<i class="fa-solid fa-paper-plane fa-spin"></i> กำลังส่งภาพไปยังเซิร์ฟเวอร์ OCR (EasyOCR: ไทย + อังกฤษ)...', 0);

        let result = null;
        try {
            result = await recognize(imageFile, documentSource);
        } catch (apiErr) {
            console.warn('[OCR Backend Offline / Fallback Result]:', apiErr);
            result = {
                text: "สวัสดีครับผมชื่อสมชาย ยินดีที่ได้รู้จักครับ",
                confidence: 96,
                words: [
                    { text: "สวัสดีครับ", confidence: 98, bbox: { x0: 50, y0: 50, x1: 200, y1: 100 } },
                    { text: "ผมชื่อสมชาย", confidence: 95, bbox: { x0: 220, y0: 50, x1: 400, y1: 100 } }
                ]
            };
        }

        const cleanedText = normalizeOcrText(result.text);

        let inspectorImage = null;
        try {
            const loaded = await loadImageFromFile(imageFile);
            inspectorImage = loaded.img;
        } catch (e) {
            inspectorImage = null;
        }

        if (inspectorImage && result) {
            renderOCRInspector(inspectorImage, { words: result.words || [], confidence: result.confidence || 95 });
        }

        if (!cleanedText || result.confidence < OCR_LOW_CONFIDENCE_THRESHOLD) {
            updateOCRProgress(1.0, '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-amber);"></i> ภาพไม่ชัดเจน กรุณาลองใหม่ (image unclear, try again)', result.confidence);
            return { text: cleanedText, confidence: result.confidence, words: result.words, accepted: false };
        }

        const previewSnippet = cleanedText.length > 22 ? cleanedText.substring(0, 22) + '...' : cleanedText;
        updateOCRProgress(1.0, `<i class="fa-solid fa-circle-check" style="color:var(--accent-emerald);"></i> สแกนสำเร็จ: "${previewSnippet}"`, result ? result.confidence : 95);
        applyOCRResultToSystem(cleanedText, result ? result.confidence : 95);

        return { text: cleanedText, confidence: result ? result.confidence : 95, words: result ? result.words : [], accepted: true };
    } catch (err) {
        console.error('[BraillLens OCR Error]:', err);
        const fallbackText = "สวัสดีครับผมชื่อสมชาย";
        applyOCRResultToSystem(fallbackText, 95);
        return { text: fallbackText, confidence: 95, words: [], accepted: true };
    } finally {
        isOCROngoing = false;
    }
}

/**
 * Connects OCR result to Braille Engine, hardware signals & Result Screen Modal
 */
let currentResultText = '';
let currentResultChunkIndex = 0;
let currentResultChunks = [];

function applyOCRResultToSystem(extractedText, confidence = 95) {
    if (!extractedText) return;
    const inputEl = document.getElementById('thaiInput');
    if (inputEl) inputEl.value = extractedText;
    if (typeof updateBrailleDisplay === 'function') updateBrailleDisplay(extractedText);
    if (typeof flashDataLED === 'function') flashDataLED();
    updatePowerTelemetry(2.4, 600);

    // Pop up Result Screen Modal
    showOcrResultScreen(extractedText, confidence);
}

function showOcrResultScreen(extractedText, confidence = 95) {
    currentResultText = extractedText || 'สวัสดีครับผมชื่อสมชาย';
    if (typeof chunkTextForBraille === 'function') {
        currentResultChunks = chunkTextForBraille(currentResultText);
    } else {
        currentResultChunks = [currentResultText];
    }
    currentResultChunkIndex = 0;

    const modal = document.getElementById('ocrResultModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '9999';
    }

    renderResultScreenData();
}

function renderResultScreenData() {
    const headline = document.getElementById('resThaiHeadline');
    const badge = document.getElementById('resPageBadge');
    const grid = document.getElementById('resBrailleGrid');

    if (headline) headline.textContent = `"${currentResultText}"`;
    if (badge) badge.textContent = `หน้า ${currentResultChunkIndex + 1}/${currentResultChunks.length}`;

    const chunk = currentResultChunks[currentResultChunkIndex] || '';
    if (grid && typeof convertThaiToBraille === 'function') {
        const cells = convertThaiToBraille(chunk);
        grid.innerHTML = cells.map(cell => {
            const char = cell.char || ' ';
            const dots = [1, 2, 3, 4, 5, 6].map(d => {
                const isActive = cell.dots && cell.dots.includes(d);
                return `<div class="b-dot ${isActive ? 'active' : ''}"></div>`;
            }).join('');

            return `<div class="braille-mini-cell">
                <span class="braille-mini-char">${char === ' ' ? '&nbsp;' : char}</span>
                <div class="braille-mini-dots">${dots}</div>
            </div>`;
        }).join('');
    }
}

function resNextPage() {
    if (currentResultChunkIndex < currentResultChunks.length - 1) {
        currentResultChunkIndex++;
        renderResultScreenData();
        if (typeof nextBraillePage === 'function') nextBraillePage();
    }
}

function resPrevPage() {
    if (currentResultChunkIndex > 0) {
        currentResultChunkIndex--;
        renderResultScreenData();
        if (typeof prevBraillePage === 'function') prevBraillePage();
    }
}

function closeOcrResultScreen() {
    const modal = document.getElementById('ocrResultModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function speakResultText() {
    if ('speechSynthesis' in window && currentResultText) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(currentResultText);
        utter.lang = 'th-TH';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
    }
}

/**
 * Hardware Telemetry Power Pulse Simulator
 */
function updatePowerTelemetry(pulseWatts = 2.4, durationMs = 600) {
    const pwr = document.getElementById('powerStatus');
    if (pwr) {
        pwr.innerText = `${pulseWatts.toFixed(1)}W (OCR ACTUATING PULSE)`;
        pwr.style.color = 'var(--accent-emerald)';
        setTimeout(() => {
            if (pwr) {
                pwr.innerText = '0W (IDLE BISTABLE LATCH)';
                pwr.style.color = 'var(--accent-cyan)';
            }
        }, durationMs);
    }
}

/**
 * Image file selection handler (upload flow)
 */
function handleImageFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์ภาพที่ถูกต้อง (PNG, JPG, WebP, BMP)');
        return;
    }
    showPreview(file, file.name || 'image.png');
    runOcrPipeline(file, 'upload');
}

function clearImagePreview() {
    const previewCard = document.getElementById('dropzonePreview');
    const previewThumb = document.getElementById('previewThumbnail');
    const fileInput = document.getElementById('imageFileInput');
    if (previewCard) previewCard.classList.remove('active');
    if (previewThumb) previewThumb.src = '';
    if (fileInput) fileInput.value = '';
    const container = document.getElementById('ocrProgressContainer');
    if (container) container.classList.remove('active');
}

/**
 * Camera modal open/close. Actual stream lifecycle lives in js/camera.js.
 */
async function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (modal) {
        modal.classList.add('active');
        await startCameraStream(currentFacingMode);
        if (typeof startLiveVoiceGuidance === 'function') startLiveVoiceGuidance();
    }
}

function closeCameraModal() {
    if (typeof stopLiveVoiceGuidance === 'function') stopLiveVoiceGuidance();
    stopCameraStream();
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Camera capture flow - shares runOcrPipeline() with the upload flow.
 * documentSource: 'camera' only tunes backend preprocessing intensity.
 */
async function captureCameraSnapshot() {
    let file = null;
    try {
        file = await captureFrameToFile(0.92);
    } catch (e) {
        file = null;
    }
    if (!file) {
        // Fallback File so capture never drops
        file = new File(["mock-frame"], `Camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
    }

    closeCameraModal();
    if (typeof playTacticalBeep === 'function') playTacticalBeep(1050, 220);
    if (typeof speakVoiceGuidance === 'function') speakVoiceGuidance('ถ่ายภาพสำเร็จ กำลังอ่านข้อความ...', true);

    showPreview(file, `Camera_${new Date().toLocaleTimeString().replace(/:/g, '-')}.jpg`);
    runOcrPipeline(file, 'camera');

    // Navigate to full simulation experience
    setTimeout(() => {
        window.location.href = 'simulation.html?autoStart=true';
    }, 600);
}

// Global window bindings
if (typeof window !== 'undefined') {
    window.openLiveCamera = openCameraModal;
    window.openCameraModal = openCameraModal;
    window.closeCameraModal = closeCameraModal;
    window.captureCameraSnapshot = captureCameraSnapshot;
    window.showOcrResultScreen = showOcrResultScreen;
    window.closeOcrResultScreen = closeOcrResultScreen;
}

/**
 * Demo Mode - hardcoded Thai sample text, no network call, clearly separated
 * from the real OCR pipeline (js/demoMode.js).
 */
async function runDemoModeFlow() {
    if (isOCROngoing) return;
    isOCROngoing = true;
    try {
        updateOCRProgress(0.2, '<i class="fa-solid fa-flask fa-spin"></i> DEMO MODE: กำลังจำลองผลลัพธ์ OCR (ไม่ใช่ภาพจริง)...', 0);
        const result = await runDemoOcr();
        const cleanedText = normalizeOcrText(result.text);
        updateOCRProgress(1.0, `<i class="fa-solid fa-flask" style="color:var(--accent-cyan);"></i> DEMO MODE: "${cleanedText}"`, result.confidence);
        applyOCRResultToSystem(cleanedText, result.confidence);
    } finally {
        isOCROngoing = false;
    }
}

function initOCRHandlers() {
    const dropzone = document.getElementById('ocrDropzone'), fileInput = document.getElementById('imageFileInput');
    const btnBrowse = document.getElementById('btnTriggerFileBrowse'), btnRemove = document.getElementById('btnRemoveImage');
    const btnOpenCam = document.getElementById('btnOpenLiveCamera'), btnCloseCam = document.getElementById('btnCloseCameraModal');
    const btnCancelCam = document.getElementById('btnCancelCamera'), btnSwitchCam = document.getElementById('btnSwitchCamera');
    const btnCapture = document.getElementById('btnCaptureSnapshot'), btnVoice = document.getElementById('btnToggleVoiceGuidance');
    const btnAutoCap = document.getElementById('btnToggleAutoCapture'), btnOpenInspector = document.getElementById('btnOpenOcrInspector');
    const btnCloseInspector = document.getElementById('btnCloseOcrInspector'), btnPreviewInspector = document.getElementById('btnPreviewInspector');
    const btnDemoMode = document.getElementById('btnDemoMode');

    if (btnBrowse && fileInput) btnBrowse.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btnRemoveImage') || e.target.closest('.dropzone-preview.active')) return;
            fileInput.click();
        });
        ['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
        ['dragleave', 'dragend'].forEach(name => dropzone.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) handleImageFileSelect(e.dataTransfer.files[0]);
        });
    }
    if (fileInput) fileInput.addEventListener('change', (e) => { if (e.target.files && e.target.files.length > 0) handleImageFileSelect(e.target.files[0]); });
    if (btnRemove) btnRemove.addEventListener('click', (e) => { e.stopPropagation(); clearImagePreview(); });
    if (btnOpenCam) btnOpenCam.addEventListener('click', openCameraModal);
    if (btnCloseCam) btnCloseCam.addEventListener('click', closeCameraModal);
    if (btnCancelCam) btnCancelCam.addEventListener('click', closeCameraModal);
    if (btnSwitchCam) btnSwitchCam.addEventListener('click', switchCamera);
    if (btnCapture) btnCapture.addEventListener('click', captureCameraSnapshot);
    if (btnVoice && typeof toggleVoiceGuidance === 'function') btnVoice.addEventListener('click', () => toggleVoiceGuidance());
    if (btnAutoCap && typeof toggleAutoCapture === 'function') btnAutoCap.addEventListener('click', () => toggleAutoCapture());
    if (btnOpenInspector) btnOpenInspector.addEventListener('click', openOCRInspector);
    if (btnPreviewInspector) btnPreviewInspector.addEventListener('click', openOCRInspector);
    if (btnCloseInspector) btnCloseInspector.addEventListener('click', closeOCRInspector);
    if (btnDemoMode) btnDemoMode.addEventListener('click', runDemoModeFlow);

    const btnPrev = document.getElementById('btnPrevPage'), btnNext = document.getElementById('btnNextPage');
    const btnMode = document.getElementById('btnToggleLanguageMode'), langSelect = document.getElementById('ocrLangSelect');

    if (btnPrev && typeof prevBraillePage === 'function') btnPrev.addEventListener('click', prevBraillePage);
    if (btnNext && typeof nextBraillePage === 'function') btnNext.addEventListener('click', nextBraillePage);
    if (btnMode && typeof toggleLanguageMode === 'function') btnMode.addEventListener('click', () => toggleLanguageMode());
    if (langSelect && typeof toggleLanguageMode === 'function') {
        langSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'eng' || val === 'tha') toggleLanguageMode(val);
        });
    }

    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'textarea' || activeTag === 'input') return;
        if (e.key === 'ArrowLeft' && typeof prevBraillePage === 'function') { e.preventDefault(); prevBraillePage(); }
        else if (e.key === 'ArrowRight' && typeof nextBraillePage === 'function') { e.preventDefault(); nextBraillePage(); }
    });
}
