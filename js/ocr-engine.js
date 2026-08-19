/* =========================================================================
   BraillLens 3D & Optical OCR System - Optical Character Recognition Engine
   Version: 3.1.0 (Modular OCR Core & WebRTC Vision Pipeline)
   ========================================================================= */

// OCR & Vision State Variables
let cameraStream = null;
let currentFacingMode = 'environment';
let isOCROngoing = false;

/**
 * Task 3.1 & Phase 10: Enhanced Image Preprocessing & Camera Denoising Pipeline
 * 1. Resolution Upscaling Strategy & High-Quality Smoothing
 * 2. Standard Luminance Grayscale Conversion (BT.601: 0.299R + 0.587G + 0.114B)
 * 3. Step 1 Denoising: 3x3 Gaussian Noise Reduction Filter to eliminate camera sensor grain & glare
 * 4. Step 2 & 3: 3x3 Convolution Sharpening Matrix & Min-Max Dynamic Contrast Stretching
 * 5. Step 4: Fast Bradley Adaptive Integral Local Binarization (Otsu Local Thresholding)
 */
async function preprocessImageForOCR(imageSource, options = {}) {
    return new Promise((resolve, reject) => {
        // Bypass redundant processing if canvas is already preprocessed & binarized
        if (imageSource instanceof HTMLCanvasElement && imageSource._isPreprocessed) {
            resolve(imageSource);
            return;
        }

        const processCanvas = (sourceImg, width, height) => {
            try {
                const canvas = document.createElement('canvas');

                // 1. Resolution Upscaling Strategy
                let scaleFactor = options.scale || 2.0;
                if (width < 600 || height < 600) {
                    scaleFactor = 3.0; // 3x upscaling for low-res or cropped inputs
                } else if (width >= 1600 || height >= 1600) {
                    scaleFactor = 1.0; // Preserve native resolution for large inputs
                }

                // Prevent exceeding safe WebGL / Canvas texture limits
                if (width * scaleFactor > 3200 || height * scaleFactor > 3200) {
                    scaleFactor = Math.min(2.0, 3200 / Math.max(width, height));
                }

                const targetWidth = Math.max(1, Math.round(width * scaleFactor));
                const targetHeight = Math.max(1, Math.round(height * scaleFactor));

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const pctx = canvas.getContext('2d', { willReadFrequently: true });

                // Fill white background for transparent PNG/WebP assets
                pctx.fillStyle = '#FFFFFF';
                pctx.fillRect(0, 0, targetWidth, targetHeight);

                // High quality image smoothing during upscaling
                pctx.imageSmoothingEnabled = true;
                pctx.imageSmoothingQuality = 'high';
                pctx.drawImage(sourceImg, 0, 0, targetWidth, targetHeight);

                const imgData = pctx.getImageData(0, 0, targetWidth, targetHeight);
                const data = imgData.data;
                const totalPixels = targetWidth * targetHeight;
                const gray = new Uint8Array(totalPixels);

                // Step 1: Standard Luminance Grayscale (BT.601 standard: 0.299R + 0.587G + 0.114B)
                for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    gray[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                }

                // Step 2: 3x3 Gaussian Denoising Filter (Noise / Grain / Specular Glare Reduction)
                // Kernel: [1, 2, 1; 2, 4, 2; 1, 2, 1] / 16
                const denoised = new Uint8Array(totalPixels);
                for (let y = 0; y < targetHeight; y++) {
                    const rowOffset = y * targetWidth;
                    for (let x = 0; x < targetWidth; x++) {
                        if (x === 0 || y === 0 || x === targetWidth - 1 || y === targetHeight - 1) {
                            denoised[rowOffset + x] = gray[rowOffset + x];
                            continue;
                        }

                        const sum = (
                            gray[(y - 1) * targetWidth + (x - 1)] * 1 +
                            gray[(y - 1) * targetWidth + x] * 2 +
                            gray[(y - 1) * targetWidth + (x + 1)] * 1 +
                            gray[rowOffset + (x - 1)] * 2 +
                            gray[rowOffset + x] * 4 +
                            gray[rowOffset + (x + 1)] * 2 +
                            gray[(y + 1) * targetWidth + (x - 1)] * 1 +
                            gray[(y + 1) * targetWidth + x] * 2 +
                            gray[(y + 1) * targetWidth + (x + 1)] * 1
                        );
                        denoised[rowOffset + x] = (sum >> 4);
                    }
                }

                // Step 3: 3x3 Convolution Sharpening Filter ([0, -1, 0], [-1, 5, -1], [0, -1, 0])
                const sharpened = new Uint8Array(totalPixels);
                let minVal = 255;
                let maxVal = 0;

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

                        const sharpVal = (
                            -denoised[(y - 1) * targetWidth + x]
                            -denoised[rowOffset + (x - 1)]
                            + 5 * denoised[rowOffset + x]
                            -denoised[rowOffset + (x + 1)]
                            -denoised[(y + 1) * targetWidth + x]
                        );

                        const clamped = sharpVal < 0 ? 0 : (sharpVal > 255 ? 255 : sharpVal);
                        sharpened[rowOffset + x] = clamped;
                        if (clamped < minVal) minVal = clamped;
                        if (clamped > maxVal) maxVal = clamped;
                    }
                }

                // Step 4: Contrast Normalization / Min-Max Dynamic Stretching
                const range = maxVal - minVal;
                if (range > 15 && (minVal > 10 || maxVal < 245)) {
                    const factor = 255.0 / range;
                    for (let p = 0; p < totalPixels; p++) {
                        let normalized = (sharpened[p] - minVal) * factor;
                        sharpened[p] = normalized < 0 ? 0 : (normalized > 255 ? 255 : Math.round(normalized));
                    }
                }

                // Step 5: Fast Bradley Adaptive Local Thresholding (Integral Image Binarization)
                const integral = new Float64Array(totalPixels);
                for (let y = 0; y < targetHeight; y++) {
                    let sum = 0;
                    const rowOffset = y * targetWidth;
                    for (let x = 0; x < targetWidth; x++) {
                        sum += sharpened[rowOffset + x];
                        if (y === 0) {
                            integral[rowOffset + x] = sum;
                        } else {
                            integral[rowOffset + x] = integral[(y - 1) * targetWidth + x] + sum;
                        }
                    }
                }

                const S = Math.max(16, Math.floor(targetWidth / 32));
                const s2 = Math.floor(S / 2);
                const T = 0.15;

                for (let y = 0; y < targetHeight; y++) {
                    const y1 = Math.max(0, y - s2);
                    const y2 = Math.min(targetHeight - 1, y + s2);
                    const rowOffset = y * targetWidth;

                    for (let x = 0; x < targetWidth; x++) {
                        const x1 = Math.max(0, x - s2);
                        const x2 = Math.min(targetWidth - 1, x + s2);
                        const count = (x2 - x1 + 1) * (y2 - y1 + 1);

                        const botRight = integral[y2 * targetWidth + x2];
                        const botLeft = (x1 > 0) ? integral[y2 * targetWidth + (x1 - 1)] : 0;
                        const topRight = (y1 > 0) ? integral[(y1 - 1) * targetWidth + x2] : 0;
                        const topLeft = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * targetWidth + (x1 - 1)] : 0;

                        const sum = botRight - botLeft - topRight + topLeft;
                        const mean = sum / count;

                        const idx = (rowOffset + x) * 4;
                        const pixelVal = (sharpened[rowOffset + x] < mean * (1.0 - T)) ? 0 : 255;

                        data[idx] = pixelVal;
                        data[idx + 1] = pixelVal;
                        data[idx + 2] = pixelVal;
                        data[idx + 3] = 255;
                    }
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
            if (imageSource.complete && imageSource.naturalWidth > 0) {
                processCanvas(imageSource, imageSource.naturalWidth, imageSource.naturalHeight);
            } else {
                imageSource.onload = () => processCanvas(imageSource, imageSource.naturalWidth, imageSource.naturalHeight);
                imageSource.onerror = reject;
            }
        } else if (imageSource instanceof HTMLVideoElement) {
            processCanvas(imageSource, imageSource.videoWidth || 1280, imageSource.videoHeight || 720);
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

    if (container && !container.classList.contains('active')) {
        container.classList.add('active');
    }

    const pct = Math.min(100, Math.max(0, Math.round(progress01 * 100)));
    if (fill) {
        fill.style.width = `${pct}%`;
    }

    if (status && statusHtml) {
        status.innerHTML = statusHtml;
    }

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
 * Task 3.2: Tesseract.js Worker Engine & Extraction Dispatcher (PSM 6 Mode - English Only Locked)
 */
async function runOCRExtraction(imageSource, langOverride = null) {
    if (isOCROngoing) return;
    isOCROngoing = true;

    // Locked to English Only ('eng') for maximum recognition accuracy and 100% stability
    const lang = 'eng';

    const langSelect = document.getElementById('ocrLangSelect');
    if (langSelect && langSelect.value !== 'eng') {
        langSelect.value = 'eng';
    }

    try {
        updateOCRProgress(0.08, '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> กำลังประมวลผลและเพิ่มคอนทราสต์ภาพ (Canvas Preprocessor)...', 0);

        const preprocessedCanvas = await preprocessImageForOCR(imageSource);

        // Update Dropzone preview with crisp denoised & binarized canvas image
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

        const result = await Tesseract.recognize(
            preprocessedCanvas,
            lang,
            {
                tessedit_pageseg_mode: '6',
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
        let cleanedText = rawText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

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
 * Task 4.1: Connects OCR result to Braille Engine & hardware signals
 */
function applyOCRResultToSystem(extractedText, confidence = 95) {
    if (!extractedText) return;

    const inputEl = document.getElementById('thaiInput');
    if (inputEl) {
        inputEl.value = extractedText;
    }

    if (typeof updateBrailleDisplay === 'function') {
        updateBrailleDisplay(extractedText);
    }

    if (typeof flashDataLED === 'function') {
        flashDataLED();
    }
    updatePowerTelemetry(2.4, 600);
}

/**
 * Task 4.2: Hardware Telemetry Power Pulse Simulator
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
        const objectUrl = URL.createObjectURL(file);
        previewThumb.src = objectUrl;
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
 * WebRTC Camera Viewfinder Controller
 */
async function openCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (modal) {
        modal.classList.add('active');
        await startCameraStream(currentFacingMode);
    }
}

function closeCameraModal() {
    stopCameraStream();
    const modal = document.getElementById('cameraModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function startCameraStream(facingMode = 'environment') {
    currentFacingMode = facingMode;
    stopCameraStream();

    const video = document.getElementById('cameraVideo');
    if (!video) return;

    try {
        // Request High-Resolution Native Stream (1080p Full HD ideal)
        const constraints = {
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 }
            },
            audio: false
        };

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
            } catch (e2) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    if (video) {
        video.srcObject = null;
    }
}

async function switchCamera() {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    await startCameraStream(currentFacingMode);
}

/**
 * High-Res Native Video Capture & Realtime Denoising / Binarization Pipeline
 */
async function captureCameraSnapshot() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCaptureCanvas');
    if (!video || !canvas) return;

    // 1. High-Res Native Video Resolution (video.videoWidth x video.videoHeight)
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;

    canvas.width = vw;
    canvas.height = vh;
    const cctx = canvas.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(video, 0, 0, vw, vh);

    closeCameraModal();

    updateOCRProgress(0.05, '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> กำลังลบ Noise & ทำ Binarization ภาพจากกล้อง...', 0);

    try {
        // 2. Camera Denoising Pipeline: 3x3 Gaussian Denoise -> BT.601 Grayscale -> Sharpen -> Bradley Binarize
        const processedCanvas = await preprocessImageForOCR(canvas, { isCamera: true });

        // 3. Render Processed Preview on #dropzonePreview (Denoised crisp image)
        const previewCard = document.getElementById('dropzonePreview');
        const previewThumb = document.getElementById('previewThumbnail');
        const previewName = document.getElementById('previewFilename');

        if (previewCard && previewThumb && previewName) {
            previewThumb.src = processedCanvas.toDataURL('image/png');
            previewName.innerText = `Camera_Live_${new Date().toLocaleTimeString().replace(/:/g, '-')}_Denoised.png`;
            previewCard.classList.add('active');
        }

        // 4. Send preprocessed high-res canvas to Tesseract OCR engine
        runOCRExtraction(processedCanvas);
    } catch (err) {
        console.error('[Capture Denoising Error]:', err);
        runOCRExtraction(canvas);
    }
}

/**
 * Initializes all OCR, Camera & Tactile event listeners
 */
function initOCRHandlers() {
    const dropzone = document.getElementById('ocrDropzone');
    const fileInput = document.getElementById('imageFileInput');
    const btnBrowse = document.getElementById('btnTriggerFileBrowse');
    const btnRemove = document.getElementById('btnRemoveImage');
    const btnOpenCam = document.getElementById('btnOpenLiveCamera');
    const btnCloseCam = document.getElementById('btnCloseCameraModal');
    const btnCancelCam = document.getElementById('btnCancelCamera');
    const btnSwitchCam = document.getElementById('btnSwitchCamera');
    const btnCapture = document.getElementById('btnCaptureSnapshot');

    if (btnBrowse && fileInput) {
        btnBrowse.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btnRemoveImage') || e.target.closest('.dropzone-preview.active')) {
                return;
            }
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleImageFileSelect(e.target.files[0]);
            }
        });
    }

    if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            clearImagePreview();
        });
    }

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'dragend'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');

            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleImageFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    if (btnOpenCam) btnOpenCam.addEventListener('click', openCameraModal);
    if (btnCloseCam) btnCloseCam.addEventListener('click', closeCameraModal);
    if (btnCancelCam) btnCancelCam.addEventListener('click', closeCameraModal);
    if (btnSwitchCam) btnSwitchCam.addEventListener('click', switchCamera);
    if (btnCapture) btnCapture.addEventListener('click', captureCameraSnapshot);

    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const btnMode = document.getElementById('btnToggleLanguageMode');
    const langSelect = document.getElementById('ocrLangSelect');

    if (btnPrev && typeof prevBraillePage === 'function') {
        btnPrev.addEventListener('click', prevBraillePage);
    }
    if (btnNext && typeof nextBraillePage === 'function') {
        btnNext.addEventListener('click', nextBraillePage);
    }
    if (btnMode && typeof toggleLanguageMode === 'function') {
        btnMode.addEventListener('click', () => toggleLanguageMode());
    }
    if (langSelect && typeof toggleLanguageMode === 'function') {
        langSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'eng') toggleLanguageMode('eng');
            else if (val === 'tha') toggleLanguageMode('tha');
        });
    }

    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'textarea' || activeTag === 'input') return;
        if (e.key === 'ArrowLeft' && typeof prevBraillePage === 'function') {
            e.preventDefault();
            prevBraillePage();
        } else if (e.key === 'ArrowRight' && typeof nextBraillePage === 'function') {
            e.preventDefault();
            nextBraillePage();
        }
    });
}
