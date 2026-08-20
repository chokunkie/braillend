/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Module
   The ONLY place in the app that knows how OCR is actually performed.
   Sends the image to the EasyOCR (Thai + English) FastAPI backend and
   returns a normalized result shape. Nothing downstream needs to know this
   used to be an in-browser Tesseract.js call.
   ========================================================================= */

const OCR_BACKEND_URL = 'http://localhost:8000/ocr';

/**
 * Runs OCR on an image via the backend.
 * @param {File|Blob} imageFile - JPEG image, from either upload or camera capture.
 * @param {'upload'|'camera'} documentSource - UI label only; the backend uses it
 *   solely to tune preprocessing intensity, never to change the OCR code path.
 * @returns {Promise<{text: string, confidence: number, words: Array}>}
 */
async function recognize(imageFile, documentSource = 'upload') {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('documentSource', documentSource);

    const response = await fetch(OCR_BACKEND_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`OCR backend error (${response.status}): ${detail || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.text || '',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        words: Array.isArray(data.words) ? data.words : []
    };
}
