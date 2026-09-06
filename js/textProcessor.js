/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Text Normalizer
   Normalizes raw OCR output before it reaches the Braille engine. Thai-aware:
   preserves the Thai Unicode block and never forces case (Thai has none).
   ========================================================================= */

// Thai block (U+0E00-U+0E7F), latin letters, digits, basic punctuation & whitespace
const OCR_ALLOWED_CHARS_PATTERN = /[^฀-๿a-zA-Z0-9 .,!?%()\-\/\n]/g;

// Thai combining marks (tone marks, above/below vowels, thanthakhat,
// nikhahit) are only valid stacked on a preceding Thai consonant. One
// appearing with no consonant base is not a spelling Thai print ever
// produces - it's a detector picking a stray mark off a noisy background
// (solder pads, silkscreen, glare) and misreading it as a combining
// character. Stripped by stripOrphanCombiningMarks() below.
const THAI_COMBINING_MARK = /[ัิ-ฺ็-๎]/;
const THAI_CONSONANT = /[ก-ฮ]/;

/**
 * Drops Thai combining marks that have no Thai consonant base to attach to
 * (scanning back through any already-stacked combining marks to find one).
 * A legitimate stack like กี่ (consonant + vowel + tone) is left untouched;
 * an orphan run like the leading "ื ุ" in OCR noise such as "ืุe" is removed.
 */
function stripOrphanCombiningMarks(text) {
    const chars = Array.from(text);
    const out = [];
    for (const ch of chars) {
        if (THAI_COMBINING_MARK.test(ch)) {
            let j = out.length - 1;
            while (j >= 0 && THAI_COMBINING_MARK.test(out[j])) j--;
            if (j >= 0 && THAI_CONSONANT.test(out[j])) {
                out.push(ch);
            }
            // else: orphan mark, drop it
            continue;
        }
        out.push(ch);
    }
    return out.join('');
}

/**
 * Normalizes raw OCR text: Unicode NFC normalization (required so Thai tone
 * marks / vowels expressed as separate combining codepoints compose correctly
 * before Braille lookup), drops orphan Thai combining marks (OCR noise from
 * cluttered backgrounds), strips characters outside the allowed ranges, and
 * collapses whitespace. Does NOT uppercase - Thai has no case, and forcing
 * case here would corrupt mixed Thai/English OCR output.
 */
function normalizeOcrText(text) {
    if (!text) return '';
    let normalized = text.normalize('NFC');
    normalized = stripOrphanCombiningMarks(normalized);
    normalized = normalized.replace(OCR_ALLOWED_CHARS_PATTERN, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}

// OCR confidence buckets shared by every result screen, so the badge isn't
// a misleading binary green/red. A 54% read is NOT "detected text" - it's
// "we saw something but half of it is probably wrong".
const OCR_CONF_HIGH = 72;
const OCR_CONF_MEDIUM = 45;

/**
 * @returns {'high'|'medium'|'low'} confidence bucket for an OCR result.
 */
function classifyOcrConfidence(confidence) {
    const c = (typeof confidence === 'number' && isFinite(confidence)) ? confidence : 0;
    if (c >= OCR_CONF_HIGH) return 'high';
    if (c >= OCR_CONF_MEDIUM) return 'medium';
    return 'low';
}
