/* =========================================================================
   BraillLens 3D & Optical OCR System - Optical Character Recognition Engine
   Version: 3.3.0 (Visual OCR Bounding Box Inspector & Viewfinder Crop Core)
   ========================================================================= */

// OCR & Vision State Variables
let cameraStream = null;
let currentFacingMode = 'environment';
let isOCROngoing = false;
let lastOcrInspectorData = null;

/**
 * Grayscale High-Contrast Preprocessing Pipeline
 * BT.601 Grayscale -> 3x3 Gaussian Denoise -> 3x3 Sharpen -> Contrast Stretch -> Auto Polarity
 */
async function preprocessImageForOCR(imageSource, options = {}) {
    return new Promise((resolve, reject) => {
        if (imageSource instanceof HTMLCanvasElement && imageSource._isPreprocessed) {
            resolve(imageSource);
            return;
        }

        const processCanvas = (sourceImg, width, height) => {
            try {
                const canvas = document.createElement('canvas');
                let scaleFactor = options.scale || (width < 600 || height < 600 ? 3.0 : (width >= 1600 || height >= 1600 ? 1.0 : 2.0));
                if (width * scaleFactor > 3200 || height * scaleFactor > 3200) {
                    scaleFactor = Math.min(2.0, 3200 / Math.max(width, height));
                }

                const targetWidth = Math.max(1, Math.round(width * scaleFactor));
                const targetHeight = Math.max(1, Math.round(height * scaleFactor));
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const pctx = canvas.getContext('2d', { willReadFrequently: true });
                pctx.fillStyle = '#FFFFFF';
                pctx.fillRect(0, 0, targetWidth, targetHeight);
                pctx.imageSmoothingEnabled = true;
                pctx.imageSmoothingQuality = 'high';
                pctx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);

                const imgData = pctx.getImageData(0, 0, targetWidth, targetHeight);
                const data = imgData.data;
                const totalPixels = targetWidth * targetHeight;
                const gray = new Uint8Array(totalPixels);

                // Step 1: Standard Luminance Grayscale (BT.601: 0.299R + 0.587G + 0.114B)
                let sumLuma = 0;
                for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                    gray[p] = luma;
                    sumLuma += luma;
                }

                // Step 2: 3x3 Gaussian Denoising Filter (Kernel: [1, 2, 1; 2, 4, 2; 1, 2, 1] / 16)
                const denoised = new Uint8Array(totalPixels);
                for (let y = 0; y < targetHeight; y++) {
                    const rowOffset = y * targetWidth;
                    for (let x = 0; x < targetWidth; x++) {
                        if (x === 0 || y === 0 || x === targetWidth - 1 || y === targetHeight - 1) {
                            denoised[rowOffset + x] = gray[rowOffset + x];
                            continue;
                        }
                        const sum = (
                            gray[(y - 1) * targetWidth + (x - 1)] * 1 + gray[(y - 1) * targetWidth + x] * 2 + gray[(y - 1) * targetWidth + (x + 1)] * 1 +
                            gray[rowOffset + (x - 1)] * 2 + gray[rowOffset + x] * 4 + gray[rowOffset + (x + 1)] * 2 +
                            gray[(y + 1) * targetWidth + (x - 1)] * 1 + gray[(y + 1) * targetWidth + x] * 2 + gray[(y + 1) * targetWidth + (x + 1)] * 1
                        );
                        denoised[rowOffset + x] = (sum >> 4);
                    }
                }

                // Step 3: 3x3 Convolution Sharpening Filter ([0, -1, 0], [-1, 5, -1], [0, -1, 0])
                const sharpened = new Uint8Array(totalPixels);
                let minVal = 255, maxVal = 0;
                for (let y = 0; y < targetHeight; y++) {
                    const rowOffset = y * targetWidth;
                    for (let x = 0; x < targetWidth; x++) {
                        if (x === 0 || y === 0 || x === targetWidth - 1 || y === targetHeight - 1) {
                            const edgeVal = denoised[rowOffset + x];
                            sharpened[rowOffset + x] = edgeVal;
                            if (edgeVal < minVal) minVal = edgeVal;
                            if (edgeVal > maxVal) maxVal = edgeVal;
                            continue;
                        }
                        const sharpVal = -denoised[(y - 1) * targetWidth + x] - denoised[rowOffset + (x - 1)] + 5 * denoised[rowOffset + x] - denoised[rowOffset + (x + 1)] - denoised[(y + 1) * targetWidth + x];
                        const clamped = sharpVal < 0 ? 0 : (sharpVal > 255 ? 255 : sharpVal);
                        sharpened[rowOffset + x] = clamped;
                        if (clamped < minVal) minVal = clamped;
                        if (clamped > maxVal) maxVal = clamped;
                    }
                }

                // Step 4: Dynamic Contrast Normalization / Min-Max Histogram Stretching
                const range = maxVal - minVal;
                const factor = range > 15 ? (255.0 / range) : 1.0;
                let avgStretchedLuma = 0;
                for (let p = 0; p < totalPixels; p++) {
                    const normalized = range > 15 ? (sharpened[p] - minVal) * factor : sharpened[p];
                    const clampedVal = normalized < 0 ? 0 : (normalized > 255 ? 255 : Math.round(normalized));
                    sharpened[p] = clampedVal;
                    avgStretchedLuma += clampedVal;
                }

                // Step 5: Auto Polarity Inversion (Invert if dark background with bright text)
                const isDarkBackground = (avgStretchedLuma / totalPixels) < 120;
                for (let p = 0; p < totalPixels; p++) {
                    let pixelVal = isDarkBackground ? (255 - sharpened[p]) : sharpened[p];
                    const idx = p * 4;
                    data[idx] = pixelVal;
                    data[idx + 1] = pixelVal;
                    data[idx + 2] = pixelVal;
                    data[idx + 3] = 255;
                }

                pctx.putImageData(imgData, 0, 0);
                canvas._isPreprocessed = true;
                resolve(canvas);
            } catch (err) {
                reject(err);
            }
        };

        if (imageSource instanceof HTMLCanvasElement) {
            processCanvas(imageSource, imageSource.width, imageSource.height);
        } else if (imageSource instanceof HTMLImageElement) {
            if (imageSource.complete && imageSource.naturalWidth > 0) processCanvas(imageSource, imageSource.naturalWidth, imageSource.naturalHeight);
            else { imageSource.onload = () => processCanvas(imageSource, imageSource.naturalWidth, imageSource.naturalHeight); imageSource.onerror = reject; }
        } else if (imageSource instanceof HTMLVideoElement) {
            processCanvas(imageSource, imageSource.videoWidth || 1080, imageSource.videoHeight || 1920);
        } else if (imageSource instanceof Blob || imageSource instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => processCanvas(img, img.naturalWidth, img.naturalHeight);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageSource);
        } else if (typeof imageSource === 'string') {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => processCanvas(img, img.naturalWidth, img.naturalHeight);
            img.onerror = reject;
            img.src = imageSource;
        } else {
            reject(new Error('Unsupported image source type for OCR preprocessing.'));
        }
    });
}

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
        } else if (confidence >= 50) {
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

    // Draw base scanned image
    ctx.drawImage(imageSource, 0, 0, srcW, srcH);

    const words = (ocrData && ocrData.words && ocrData.words.length > 0)
        ? ocrData.words
        : ((ocrData && ocrData.lines) ? ocrData.lines.flatMap(l => l.words || [l]) : []);

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

    // Draw glowing bounding boxes & label tags
    for (const w of words) {
        const bbox = w.bbox;
        if (!bbox) continue;
        const bx = bbox.x0, by = bbox.y0;
        const bw = bbox.x1 - bbox.x0, bh = bbox.y1 - bbox.y0;
        if (bw <= 0 || bh <= 0) continue;

        ctx.save();
        // 1. Neon glowing bounding box outline
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = Math.max(2, Math.round(srcW / 500));
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 8;
        ctx.strokeRect(bx, by, bw, bh);

        // 2. Translucent overlay fill
        ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
        ctx.fillRect(bx, by, bw, bh);

        // 3. Label tag above bounding box
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

/**
 * Opens OCR Bounding Box Inspector Modal
 */
function openOCRInspector() {
    const modal = document.getElementById('ocrInspectorModal');
    if (modal) {
        modal.classList.add('active');
        if (lastOcrInspectorData) renderOCRInspector(lastOcrInspectorData.canvas, lastOcrInspectorData.data);
    }
}

/**
 * Closes OCR Bounding Box Inspector Modal
 */
function closeOCRInspector() {
    const modal = document.getElementById('ocrInspectorModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Tesseract.js Worker Engine & Extraction Dispatcher (PSM 3 Mode - English Only Locked)
 */
async function runOCRExtraction(imageSource, langOverride = null) {
    if (isOCROngoing) return;
    isOCROngoing = true;
    const lang = 'eng'; // Locked to English Only ('eng')

    const langSelect = document.getElementById('ocrLangSelect');
    if (langSelect && langSelect.value !== 'eng') langSelect.value = 'eng';

    try {
        updateOCRProgress(0.08, '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> กำลังปรับปรุงคอนทราสต์ภาพ (Grayscale-First Pipeline)...', 0);
        const preprocessedCanvas = await preprocessImageForOCR(imageSource);

        const previewCard = document.getElementById('dropzonePreview');
        const previewThumb = document.getElementById('previewThumbnail');
        if (previewCard && previewThumb && preprocessedCanvas) {
            previewThumb.src = preprocessedCanvas.toDataURL('image/png');
            previewCard.classList.add('active');
        }

        updateOCRProgress(0.2, `<i class="fa-solid fa-microchip fa-spin"></i> กำลังโหลดโมเดล OCR (${lang.toUpperCase()})...`);
        if (typeof Tesseract === 'undefined') {
            throw new Error('ไม่พบไลบรารี Tesseract.js ในระบบ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        }

        // PSM 3 (PSM.AUTO) for full page layout analysis, automatic angle detection & OCR accuracy
        const result = await Tesseract.recognize(
            preprocessedCanvas,
            lang,
            {
                tessedit_pageseg_mode: '3',
                logger: (m) => {
                    if (m.status === 'loading tesseract core') {
                        updateOCRProgress(0.15 + (m.progress || 0) * 0.15, '<i class="fa-solid fa-download fa-spin"></i> กำลังโหลด Tesseract Core...');
                    } else if (m.status === 'loading language traineddata') {
                        updateOCRProgress(0.30 + (m.progress || 0) * 0.25, `<i class="fa-solid fa-book-open-reader fa-spin"></i> กำลังโหลดพจนานุกรม (${lang.toUpperCase()}) ${Math.round((m.progress || 0) * 100)}%...`);
                    } else if (m.status === 'initializing api') {
                        updateOCRProgress(0.58, '<i class="fa-solid fa-gears fa-spin"></i> กำลังเริ่มต้นโมเดลโครงข่ายประสาท (Neural Network)...');
                    } else if (m.status === 'recognizing text') {
                        const subProgress = 0.60 + (m.progress || 0) * 0.38;
                        updateOCRProgress(subProgress, `<i class="fa-solid fa-magnifying-glass fa-spin"></i> กำลังถอดรหัสตัวอักษร (${Math.round((m.progress || 0) * 100)}%)...`);
                    }
                }
            }
        );

        const rawText = (result && result.data && result.data.text) ? result.data.text : '';
        const confidence = (result && result.data && typeof result.data.confidence === 'number') ? result.data.confidence : 90;
        const cleanedText = rawText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

        if (!cleanedText) {
            updateOCRProgress(1.0, '<i class="fa-solid fa-circle-exclamation" style="color:var(--accent-amber);"></i> ไม่พบตัวอักษรในภาพ กรุณาถ่ายภาพใหม่หรือปรับมุมกล้อง', 0);
            setTimeout(() => {
                const container = document.getElementById('ocrProgressContainer');
                if (container) container.classList.remove('active');
            }, 4000);
        } else {
            const previewSnippet = cleanedText.length > 22 ? cleanedText.substring(0, 22) + '...' : cleanedText;
            updateOCRProgress(1.0, `<i class="fa-solid fa-circle-check" style="color:var(--accent-emerald);"></i> สแกนสำเร็จ: "${previewSnippet}"`, confidence);
            applyOCRResultToSystem(cleanedText, confidence);
        }

        // Render Visual OCR Bounding Box Inspector
        if (result && result.data) renderOCRInspector(preprocessedCanvas || imageSource, result.data);
        return { text: cleanedText, confidence: confidence, rawResult: result };
    } catch (err) {
        console.error('[BraillLens OCR Error]:', err);
        updateOCRProgress(1.0, `<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-magenta);"></i> ผิดพลาด: ${err.message || err}`, 0);
        return null;
    } finally {
        isOCROngoing = false;
    }
}

/**
 * Connects OCR result to Braille Engine & hardware signals
 */
function applyOCRResultToSystem(extractedText, confidence = 95) {
    if (!extractedText) return;
    const inputEl = document.getElementById('thaiInput');
    if (inputEl) inputEl.value = extractedText;
    if (typeof updateBrailleDisplay === 'function') updateBrailleDisplay(extractedText);
    if (typeof flashDataLED === 'function') flashDataLED();
    updatePowerTelemetry(2.4, 600);
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
 * Image file selection handler
 */
function handleImageFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์ภาพที่ถูกต้อง (PNG, JPG, WebP, BMP)');
        return;
    }
    const previewCard = document.getElementById('dropzonePreview');
    const previewThumb = document.getElementById('previewThumbnail');
    const previewName = document.getElementById('previewFilename');
    if (previewCard && previewThumb && previewName) {
        previewThumb.src = URL.createObjectURL(file);
        previewName.innerText = file.name || 'image.png';
        previewCard.classList.add('active');
    }
    runOCRExtraction(file);
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
 * WebRTC Camera Viewfinder Controller & Live Guidance Bootstrap
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

async function startCameraStream(facingMode = 'environment') {
    currentFacingMode = facingMode;
    stopCameraStream();
    const video = document.getElementById('cameraVideo');
    if (!video) return;

    try {
        const constraints = {
            video: {
                facingMode: { ideal: facingMode },
                aspectRatio: { ideal: 9 / 16 },
                width: { ideal: 1080, min: 720 },
                height: { ideal: 1920, min: 1280 }
            },
            audio: false
        };
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: facingMode },
                        aspectRatio: { ideal: 9 / 16 },
                        width: { ideal: 720 },
                        height: { ideal: 1280 }
                    },
                    audio: false
                });
            } catch (e2) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: facingMode } },
                        audio: false
                    });
                } catch (e3) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                }
            }
        }
        cameraStream = stream;
        video.srcObject = stream;
        await video.play();
    } catch (err) {
        console.error('[WebRTC Camera Error]:', err);
        alert(`ไม่สามารถเปิดใช้งานกล้องได้: ${err.message || 'กรุณาอนุญาตการเข้าถึงกล้องบนเบราว์เซอร์'}`);
        closeCameraModal();
    }
}

function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraVideo');
    if (video) video.srcObject = null;
}

async function switchCamera() {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    await startCameraStream(currentFacingMode);
}

/**
 * Calculates viewfinder crop coordinates with exact scale factoring, safety clamping & 85% fallback
 */
function calculateViewfinderCrop(video, box, frame) {
    const vw = (video && video.videoWidth > 0) ? video.videoWidth : 1080;
    const vh = (video && video.videoHeight > 0) ? video.videoHeight : 1920;

    const getFallback = () => {
        const sw = Math.max(50, Math.round(vw * 0.85));
        const sh = Math.max(50, Math.round(vh * 0.85));
        const sx = Math.max(0, Math.round((vw - sw) / 2));
        const sy = Math.max(0, Math.round((vh - sh) / 2));
        return { sx, sy, sw, sh };
    };

    if (!video || !box) return getFallback();

    try {
        const bw = video.clientWidth || box.clientWidth || 0;
        const bh = video.clientHeight || box.clientHeight || 0;
        if (bw <= 0 || bh <= 0 || vw <= 0 || vh <= 0) return getFallback();

        const videoStyle = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(video) : null;
        const fitMode = videoStyle ? videoStyle.objectFit : 'contain';

        const scale = (fitMode === 'cover') ? Math.max(bw / vw, bh / vh) : Math.min(bw / vw, bh / vh);
        if (scale <= 0 || isNaN(scale)) return getFallback();

        const renderW = vw * scale;
        const renderH = vh * scale;
        const renderLeft = (bw - renderW) / 2;
        const renderTop = (bh - renderH) / 2;

        let frameLeft, frameTop, frameWidth, frameHeight;
        if (frame && typeof frame.getBoundingClientRect === 'function') {
            const frameRect = frame.getBoundingClientRect();
            const containerEl = (video.clientWidth > 0 ? video : box);
            const containerRect = containerEl.getBoundingClientRect();
            if (containerRect.width > 0 && containerRect.height > 0 && frameRect.width > 0 && frameRect.height > 0) {
                frameLeft = frameRect.left - containerRect.left;
                frameTop = frameRect.top - containerRect.top;
                frameWidth = frameRect.width;
                frameHeight = frameRect.height;
            }
        }

        if (!frameWidth || !frameHeight || frameWidth <= 0 || frameHeight <= 0) {
            frameWidth = bw * 0.82;
            frameHeight = bh * 0.78;
            frameLeft = (bw - frameWidth) / 2;
            frameTop = (bh - frameHeight) / 2;
        }

        const rawSx = (frameLeft - renderLeft) / scale;
        const rawSy = (frameTop - renderTop) / scale;
        const rawSw = frameWidth / scale;
        const rawSh = frameHeight / scale;

        const sx = Math.max(0, Math.min(vw - 20, Math.round(rawSx)));
        const sy = Math.max(0, Math.min(vh - 20, Math.round(rawSy)));
        const sw = Math.max(20, Math.min(vw - sx, Math.round(rawSw)));
        const sh = Math.max(20, Math.min(vh - sy, Math.round(rawSh)));

        if (isNaN(sx) || isNaN(sy) || isNaN(sw) || isNaN(sh) || sw < 50 || sh < 50) return getFallback();
        return { sx, sy, sw, sh };
    } catch (err) {
        console.warn('[Viewfinder Crop Calculation Fallback]:', err);
        return getFallback();
    }
}

/**
 * Viewfinder Crop Engine & Grayscale Snapshot Capture
 */
async function captureCameraSnapshot() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCaptureCanvas');
    if (!video || !canvas) return;

    const box = document.getElementById('viewfinderBox');
    const frame = document.querySelector('.viewfinder-frame');
    const { sx, sy, sw, sh } = calculateViewfinderCrop(video, box, frame);

    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const cctx = canvas.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    closeCameraModal();
    if (typeof playTacticalBeep === 'function') playTacticalBeep(1050, 220);
    if (typeof speakVoiceGuidance === 'function') speakVoiceGuidance('ถ่ายภาพสำเร็จ กำลังอ่านข้อความภาษาอังกฤษ...', true);
    updateOCRProgress(0.05, '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> กำลังปรับปรุงคอนทราสต์ภาพจากกรอบเล็ง (Viewfinder Crop)...', 0);

    try {
        const processedCanvas = await preprocessImageForOCR(canvas, { isCamera: true });
        const previewCard = document.getElementById('dropzonePreview');
        const previewThumb = document.getElementById('previewThumbnail');
        const previewName = document.getElementById('previewFilename');

        if (previewCard && previewThumb && previewName) {
            previewThumb.src = processedCanvas.toDataURL('image/png');
            previewName.innerText = `Camera_Crop_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`;
            previewCard.classList.add('active');
        }

        runOCRExtraction(processedCanvas);
    } catch (err) {
        console.error('[Capture Denoising Error]:', err);
        runOCRExtraction(canvas);
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
