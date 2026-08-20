/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Module
   The ONLY place in the app that knows how OCR is actually performed.
   Sends the image to the EasyOCR (Thai + English) FastAPI backend and
   returns a normalized result shape. Supports self-hosted in-browser Tesseract.js.
   ========================================================================= */

const OCR_BACKEND_URL = 'http://localhost:8000/ocr';

/**
 * Runs OCR on an image via the backend with self-hosted in-browser Tesseract fallback.
 * @param {File|Blob} imageFile - JPEG image, from either upload or camera capture.
 * @param {'upload'|'camera'} documentSource - UI label only; the backend uses it
 *   solely to tune preprocessing intensity, never to change the OCR code path.
 * @returns {Promise<{text: string, confidence: number, words: Array}>}
 */
async function recognize(imageFile, documentSource = 'upload') {
    // 1. Primary Engine: EasyOCR FastAPI Backend (Python Server)
    try {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('documentSource', documentSource);

        const response = await fetch(OCR_BACKEND_URL, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
                return {
                    text: data.text || '',
                    confidence: typeof data.confidence === 'number' ? data.confidence : 90,
                    words: Array.isArray(data.words) ? data.words : []
                };
            }
        }
    } catch (backendErr) {
        console.warn('[EasyOCR Backend offline, running In-Browser Tesseract.js Engine]:', backendErr);
    }

    // 2. Secondary Engine: Self-Hosted In-Browser Client OCR (Tesseract.js Thai Only - Google High-Accuracy LSTM)
    if (typeof Tesseract !== 'undefined') {
        try {
            console.log('[Tesseract.js]: Processing real image with Google High-Accuracy Thai model from ./tessdata ...');
            
            let res = null;
            if (window._cachedTesseractWorker) {
                try {
                    await window._cachedTesseractWorker.setParameters({
                        tessedit_pageseg_mode: '6',
                        preserve_interword_spaces: '1'
                    });
                } catch (e) {}
                res = await window._cachedTesseractWorker.recognize(imageFile);
            } else {
                const langPath = (typeof window !== 'undefined' && window.location) 
                    ? window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/tessdata'
                    : './tessdata';
                res = await Tesseract.recognize(imageFile, 'tha', {
                    langPath: langPath,
                    gzip: true,
                    tessedit_pageseg_mode: '6',
                    logger: m => {
                        if (m && m.status) console.log(`[Tesseract OCR (Thai LSTM)]: ${m.status} ${(m.progress ? Math.round(m.progress * 100) + '%' : '')}`);
                    }
                });
            }

            let extractedText = (res && res.data && res.data.text) ? res.data.text.trim() : '';
            // Clean up extraneous line breaks
            extractedText = extractedText.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            const conf = (res && res.data && res.data.confidence) ? Math.round(res.data.confidence) : 85;
            const wordsList = (res.data && Array.isArray(res.data.words)) ? res.data.words.map(w => ({
                text: w.text,
                confidence: w.confidence,
                bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }
            })) : [];

            return {
                text: extractedText,
                confidence: conf,
                words: wordsList
            };
        } catch (tessErr) {
            console.warn('[In-Browser Tesseract.js Error]:', tessErr);
        }
    }

    return {
        text: '',
        confidence: 0,
        words: []
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
