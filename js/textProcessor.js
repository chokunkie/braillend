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
 * cluttered backgrounds), strips characters outside the allowed ranges,
 * collapses whitespace, and finally restores unambiguous dropped/swapped Thai
 * tone marks against the bundled wordlist (see repairThaiToneMarks). Does NOT
 * uppercase - Thai has no case, and forcing case here would corrupt mixed
 * Thai/English OCR output.
 */
function normalizeOcrText(text) {
    if (!text) return '';
    let normalized = text.normalize('NFC');
    normalized = stripOrphanCombiningMarks(normalized);
    normalized = normalized.replace(OCR_ALLOWED_CHARS_PATTERN, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    try {
        normalized = repairThaiToneMarks(normalized);
    } catch (e) {
        // A repair failure must never block showing the OCR result.
        if (typeof console !== 'undefined') console.warn('[repairThaiToneMarks]', e);
    }
    return normalized;
}

// ---------------------------------------------------------------------------
// Conservative dictionary-guided repair of dropped / swapped Thai tone marks
// in OCR output. Thai OCR very commonly loses a tone mark ("ก่อน" -> "กอน")
// or swaps one for a lookalike (่ <-> ้). When a misread token is NOT a real
// word but EXACTLY ONE single-edit neighbour is, restoring it is safe.
// Anything ambiguous (zero, or several candidate words) is left exactly as
// OCR produced it.
//
// Guard rails:
//  - only short (2..6 char) pure-Thai tokens, and never a token that is
//    already a dictionary word (so correctly-read common words are untouched);
//  - tone-mark edits ONLY: insert / remove / substitute one of ่ ้ ๊ ๋. No
//    vowel or consonant edits - those too often land on a valid-but-wrong
//    word ("พด" -> "พัด" when "พูด" was meant; "ขึน" -> "ขืน" when "ขึ้น" was
//    meant). EasyOCR's dominant Thai failure is a dropped tone mark anyway;
//  - a tone mark may be inserted after a consonant OR after an above/below
//    vowel, since in "ขึ้น" the mark sits after the vowel ึ, not the ข;
//  - one edit only, and the exactly-one-candidate rule above.
//  Needs js/thai-wordlist.js loaded; a no-op without it. To switch the whole
//  pass off at runtime (e.g. from a page during a demo), set
//  globalThis.ENABLE_THAI_OCR_REPAIR = false.
// ---------------------------------------------------------------------------

function _repairEnabled() {
    const g = (typeof globalThis !== 'undefined') ? globalThis
        : (typeof window !== 'undefined') ? window : null;
    return !g || g.ENABLE_THAI_OCR_REPAIR !== false; // on unless explicitly disabled
}

const _REPAIR_TONE_MARKS = ['่', '้', '๊', '๋']; // ่ ้ ๊ ๋  (mai ek / tho / tri / chattawa)
// a tone mark legally attaches after a consonant or an above/below vowel /
// mai taikhu / nikhahit (ั ิ ี ึ ื ุ ู ฺ ็ ํ)
const _REPAIR_TONE_ANCHOR = /[ก-ฮัิ-ฺ็ํ]/;
const _REPAIR_PURE_THAI_TOKEN = /^[ก-๎]+$/;
const _REPAIR_MAX_TOKEN_LEN = 6;

function _repairWordlistSet() {
    const wl = (typeof globalThis !== 'undefined' && globalThis.THAI_WORDLIST)
        ? globalThis.THAI_WORDLIST
        : (typeof window !== 'undefined' ? window.THAI_WORDLIST : null);
    return (wl && wl.set && typeof wl.set.has === 'function') ? wl.set : null;
}

/**
 * All distinct single-edit Thai neighbours of `token` under the plausible-OCR
 * edit set (see the block comment above). Returns a Set, excluding `token`.
 */
function _singleEditThaiNeighbours(token) {
    const chars = Array.from(token);
    const out = new Set();
    const splice = (i, del, ins) =>
        chars.slice(0, i).join('') + (ins || '') + chars.slice(i + del).join('');

    for (let i = 0; i < chars.length; i++) {
        // insert one tone mark right after a consonant or an above/below vowel
        if (_REPAIR_TONE_ANCHOR.test(chars[i]) && _REPAIR_TONE_MARKS.indexOf(chars[i]) === -1) {
            for (const mark of _REPAIR_TONE_MARKS) {
                if (chars[i + 1] !== mark) out.add(splice(i + 1, 0, mark));
            }
        }
        if (_REPAIR_TONE_MARKS.indexOf(chars[i]) !== -1) {
            // substitute one tone mark for another
            for (const mark of _REPAIR_TONE_MARKS) {
                if (mark !== chars[i]) out.add(splice(i, 1, mark));
            }
            // remove a tone mark OCR may have hallucinated
            out.add(splice(i, 1, ''));
        }
    }

    out.delete(token);
    return out;
}

/**
 * Restores unambiguous dropped/swapped Thai tone marks in OCR text, token by
 * whitespace-delimited token. Conservative by construction - see the block
 * comment above. No-op when the wordlist isn't loaded or ENABLE_THAI_OCR_REPAIR
 * is false.
 * @param {string} text
 * @returns {string}
 */
function repairThaiToneMarks(text) {
    if (!text || !_repairEnabled()) return text;
    const set = _repairWordlistSet();
    if (!set) return text;

    return text.split(/(\s+)/).map(tok => {
        if (!tok || /\s/.test(tok)) return tok;
        if (!_REPAIR_PURE_THAI_TOKEN.test(tok)) return tok;
        const len = Array.from(tok).length;
        if (len < 2 || len > _REPAIR_MAX_TOKEN_LEN) return tok;
        if (set.has(tok)) return tok; // a real word already - never touch it

        let match = null;
        for (const nb of _singleEditThaiNeighbours(tok)) {
            if (!set.has(nb)) continue;
            if (match && match !== nb) return tok; // ambiguous - leave OCR's reading
            match = nb;
        }
        return match || tok;
    }).join('');
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
