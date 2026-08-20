/* =========================================================================
   BraillLens 3D & Optical OCR System - Demo Mode
   Returns a hardcoded, known-good Thai string after an artificial delay so
   the app can be showcased without a camera/backend. Clearly separated from
   real OCR: never touches js/ocr.js or the network.
   ========================================================================= */

const DEMO_MODE_SAMPLE_TEXT = 'สวัสดีครับ ยินดีต้อนรับสู่ระบบอักษรเบรลล์';
const DEMO_MODE_FAKE_DELAY_MS = 900;

/**
 * Simulates an OCR call, returning the same result shape as ocr.js's recognize().
 */
function runDemoOcr() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                text: DEMO_MODE_SAMPLE_TEXT,
                confidence: 97,
                words: []
            });
        }, DEMO_MODE_FAKE_DELAY_MS);
    });
}
