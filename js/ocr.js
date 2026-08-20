/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Module
   The ONLY place in the app that knows how OCR is actually performed.
   Sends the image to the EasyOCR (Thai + English) FastAPI backend and
   returns a normalized result shape. There is no in-browser fallback engine:
   if the backend can't be reached, recognize() throws so the caller can show
   a loud error instead of silently degrading to a worse OCR engine.
   ========================================================================= */

const OCR_BACKEND_URL = 'http://localhost:8000/ocr';
const OCR_REQUEST_TIMEOUT_MS = 30000;
const OCR_BACKEND_UNREACHABLE_MESSAGE = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ประมวลผลภาพได้ กรุณาตรวจสอบว่า backend กำลังทำงานอยู่';

/**
 * Runs OCR on an image via the EasyOCR FastAPI backend.
 * @param {File|Blob} imageFile - JPEG image, from either upload or camera capture.
 * @param {'upload'|'camera'} documentSource - UI label only; the backend uses it
 *   solely to tune preprocessing intensity, never to change the OCR code path.
 * @returns {Promise<{text: string, confidence: number, words: Array}>}
 * @throws {Error} with message OCR_BACKEND_UNREACHABLE_MESSAGE when the backend
 *   can't be reached (network error, timeout, or non-OK HTTP response).
 */
async function recognize(imageFile, documentSource = 'upload') {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('documentSource', documentSource);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(OCR_BACKEND_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
    } catch (networkErr) {
        console.warn('[EasyOCR Backend unreachable]:', networkErr);
        throw new Error(OCR_BACKEND_UNREACHABLE_MESSAGE);
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        console.warn('[EasyOCR Backend error]:', response.status, response.statusText);
        throw new Error(OCR_BACKEND_UNREACHABLE_MESSAGE);
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        console.warn('[EasyOCR Backend returned invalid JSON]:', parseErr);
        throw new Error(OCR_BACKEND_UNREACHABLE_MESSAGE);
    }

    return {
        text: (data && typeof data.text === 'string') ? data.text : '',
        confidence: (data && typeof data.confidence === 'number') ? data.confidence : 90,
        words: (data && Array.isArray(data.words)) ? data.words : []
    };
}

/**
 * Helper to load an Image element from File/Blob
 */
function loadImageElement(fileOrBlob) {
    return new Promise((resolve, reject) => {
        if (!fileOrBlob) return reject(new Error('No file'));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = URL.createObjectURL(fileOrBlob);
    });
}
