/* =========================================================================
   BraillLens 3D & Optical OCR System - Camera Module
   Client-side only: live camera stream lifecycle, viewfinder crop math, and
   frame capture. Never talks to the OCR backend - the guide frame is a
   visual aid only, no auto document detection.
   ========================================================================= */

let cameraStream = null;
let currentFacingMode = 'environment';

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
        if (typeof closeCameraModal === 'function') closeCameraModal();
    }
}

function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    _torchOn = false;
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
 * Crops the current video frame to the viewfinder guide box and exports it
 * as a JPEG File, ready to hand to the OCR module. The guide frame is a
 * visual aid only - this does not attempt any document edge detection.
 */
function captureFrameToFile(quality = 0.92) {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCaptureCanvas');
    if (!video || !canvas) return null;

    const box = document.getElementById('viewfinderBox');
    const frame = document.querySelector('.viewfinder-frame');
    const { sx, sy, sw, sh } = calculateViewfinderCrop(video, box, frame);

    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const cctx = canvas.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) { resolve(null); return; }
            const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            resolve(file);
        }, 'image/jpeg', quality);
    });
}

/**
 * Grabs `count` full-resolution frames from the live video a few milliseconds
 * apart, as JPEG Files. The OCR layer picks the sharpest one after the fact
 * (see recognizeBest in js/ocr.js) - a hand-held shot nearly always has one
 * frame better than the rest. Full frame, not the viewfinder crop: the
 * backend now finds and deskews the real page itself.
 */
function captureBurstFrames(count = 3, gapMs = 110, quality = 0.95) {
    const video = document.getElementById('cameraVideo');
    if (!video || (video.videoWidth <= 0 && video.readyState < 2)) {
        return Promise.resolve([]);
    }
    const w = video.videoWidth || 1080;
    const h = video.videoHeight || 1920;

    const grab = () => new Promise((resolve) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, w, h);
        c.toBlob((blob) => {
            resolve(blob ? new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' }) : null);
        }, 'image/jpeg', quality);
    });

    return new Promise(async (resolve) => {
        const frames = [];
        for (let i = 0; i < Math.max(1, count); i++) {
            frames.push(await grab());
            if (i < count - 1) await new Promise(r => setTimeout(r, gapMs));
        }
        resolve(frames.filter(Boolean));
    });
}

/**
 * Torch / flashlight control via the active video track. Support is spotty
 * (mostly Android Chrome on the rear camera), so every call is guarded and
 * failures are swallowed - the caller treats torch as a best-effort assist.
 */
function getActiveVideoTrack() {
    if (!cameraStream) return null;
    const tracks = cameraStream.getVideoTracks ? cameraStream.getVideoTracks() : [];
    return tracks && tracks.length ? tracks[0] : null;
}

function cameraSupportsTorch() {
    try {
        const track = getActiveVideoTrack();
        if (!track || !track.getCapabilities) return false;
        return !!track.getCapabilities().torch;
    } catch (e) {
        return false;
    }
}

let _torchOn = false;

async function setTorch(on) {
    try {
        const track = getActiveVideoTrack();
        if (!track || !track.applyConstraints) return false;
        if (!cameraSupportsTorch()) return false;
        if (_torchOn === !!on) return true;
        await track.applyConstraints({ advanced: [{ torch: !!on }] });
        _torchOn = !!on;
        return true;
    } catch (e) {
        console.warn('[Torch not available]:', e);
        return false;
    }
}

function isTorchOn() {
    return _torchOn;
}
