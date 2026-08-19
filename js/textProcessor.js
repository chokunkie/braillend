/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Text Normalizer
   Normalizes raw OCR output before it reaches the Braille engine. Thai-aware:
   preserves the Thai Unicode block and never forces case (Thai has none).
   ========================================================================= */

// Thai block (U+0E00-U+0E7F), latin letters, digits, basic punctuation & whitespace
const OCR_ALLOWED_CHARS_PATTERN = /[^฀-๿a-zA-Z0-9 .,!?%()\-\/\n]/g;

/**
 * Normalizes raw OCR text: Unicode NFC normalization (required so Thai tone
 * marks / vowels expressed as separate combining codepoints compose correctly
 * before Braille lookup), strips characters outside the allowed ranges, and
 * collapses whitespace. Does NOT uppercase - Thai has no case, and forcing
 * case here would corrupt mixed Thai/English OCR output.
 */
function normalizeOcrText(text) {
    if (!text) return '';
    let normalized = text.normalize('NFC');
    normalized = normalized.replace(OCR_ALLOWED_CHARS_PATTERN, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}
