/* =========================================================================
   BraillLens 3D & Optical OCR System - OCR Module
   The ONLY place in the app that knows how OCR is actually performed.
   Sends the image to the EasyOCR (Thai + English) FastAPI backend and
   returns a normalized result shape. Supports self-hosted in-browser Tesseract.js.
   ========================================================================= */

// Relative, not absolute: backend/main.py mounts the static frontend and
// the /ocr route on the SAME origin (python run_server.py serves both on
// one port), so this resolves correctly whether that origin is
// http://localhost:8000, a tunnel URL (ngrok/Cloudflare Tunnel), or a real
// deployed domain - no per-environment config needed. It only breaks if the
// frontend is ever served from a DIFFERENT origin than the backend.
const OCR_BACKEND_URL = '/ocr';

function emptyOcrResult(extra = {}) {
    return Object.assign({
        text: '', confidence: 0, words: [],
        engine: 'easyocr', langUsed: 'th+en',
        fallback: false, suspicious: false, warnings: [],
        rescuedLines: 0, recoveredLines: 0,
        failureReason: 'no-text', frameCount: 1, agreement: 1
    }, extra || {});
}

/**
 * Flags likely cross-script hallucinations without rejecting legitimate
 * mixed text such as "เรียน OpenAI 2026". A short Latin island embedded in
 * a Thai token ("wตตา") or a long repeated Latin run ("wnnnnnnส.e") is
 * suspicious; separate Thai and English words are not.
 */
function detectSuspiciousOcrText(text, lang = 'th+en') {
    const value = (typeof text === 'string') ? text.trim() : '';
    if (!value) return false;
    const latinChars = value.match(/[A-Za-z]/g) || [];
    if (lang === 'th' && latinChars.length > 0) return true;
    if (/([A-Za-z])\1{3,}/i.test(value)) return true;

    return value.split(/\s+/).some(token => {
        const thai = token.match(/[ก-๏]/g) || [];
        const latin = token.match(/[A-Za-z]/g) || [];
        if (!thai.length || !latin.length) return false;
        if (thai.length >= 2 && latin.length <= 3) return true;
        const uniqueLatin = new Set(latin.map(ch => ch.toLowerCase()));
        return latin.length >= 4 && uniqueLatin.size <= 3;
    });
}

function mergeOcrWarnings(...warningLists) {
    const merged = [];
    warningLists.forEach(list => {
        (Array.isArray(list) ? list : []).forEach(warning => {
            if (warning && !merged.includes(warning)) merged.push(warning);
        });
    });
    return merged;
}

/**
 * Runs OCR on an image via the backend with self-hosted in-browser Tesseract fallback.
 * @param {File|Blob} imageFile - JPEG image, from either upload or camera capture.
 * @param {'upload'|'camera'} documentSource - UI label only; the backend uses it
 *   solely to tune preprocessing intensity, never to change the OCR code path.
 * @param {'th+en'|'th'} lang - which EasyOCR language set to run. 'th' (Thai
 *   only) is more accurate on pure-Thai pages; 'th+en' handles mixed text.
 * @returns {Promise<{text: string, confidence: number, words: Array, warpedImage?: string}>}
 */
async function recognize(imageFile, documentSource = 'upload', lang = 'th+en') {
    // 1. Primary Engine: EasyOCR FastAPI Backend (Python Server)
    let backendFailure = null;
    try {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('documentSource', documentSource);
        formData.append('lang', lang === 'th' ? 'th' : 'th+en');

        const response = await fetch(OCR_BACKEND_URL, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const text = (data && typeof data.text === 'string') ? data.text : '';
            const langUsed = (data && typeof data.langUsed === 'string')
                ? data.langUsed : (lang === 'th' ? 'th' : 'th+en');
            const localSuspicious = detectSuspiciousOcrText(text, langUsed);
            return {
                text,
                confidence: (data && typeof data.confidence === 'number') ? data.confidence : 0,
                words: (data && Array.isArray(data.words)) ? data.words : [],
                warped: !!(data && data.warped),
                warpedImage: (data && typeof data.warpedImage === 'string') ? data.warpedImage : null,
                engine: (data && data.engine) || 'easyocr',
                langUsed,
                rescuedLines: (data && Number.isFinite(data.rescuedLines)) ? data.rescuedLines : 0,
                recoveredLines: (data && Number.isFinite(data.recoveredLines)) ? data.recoveredLines : 0,
                fallback: false,
                suspicious: !!(data && data.suspicious) || localSuspicious,
                warnings: mergeOcrWarnings(
                    data && data.warnings,
                    localSuspicious ? ['suspicious-script-mix'] : []
                ),
                failureReason: (data && data.failureReason) || (text.trim() ? null : 'no-text'),
                frameCount: 1,
                agreement: 1
            };
        }

        // A rejected image is a valid OCR outcome, not a reason to run a
        // second engine that may hallucinate text. Only a server-side outage
        // (5xx) is eligible for the browser fallback.
        if (response.status < 500) {
            return emptyOcrResult({
                langUsed: lang === 'th' ? 'th' : 'th+en',
                failureReason: `backend-${response.status}`,
                warnings: ['backend-rejected-image']
            });
        }
        backendFailure = new Error(`OCR backend returned HTTP ${response.status}`);
    } catch (backendErr) {
        backendFailure = backendErr;
    }

    // 2. Secondary Engine: only for a genuine backend/network failure. An
    // empty successful EasyOCR read returns above and never reaches here.
    if (backendFailure && typeof Tesseract !== 'undefined') {
        try {
            console.warn('[EasyOCR Backend unavailable, running In-Browser Tesseract.js Engine]:', backendFailure);
            const tessLang = lang === 'th' ? 'tha' : 'tha+eng';
            console.log(`[Tesseract.js]: Processing real image with ${tessLang} from ./tessdata ...`);
            
            let res = null;
            if (tessLang === 'tha' && window._cachedTesseractWorker) {
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
                res = await Tesseract.recognize(imageFile, tessLang, {
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

            const suspicious = detectSuspiciousOcrText(extractedText, lang);
            return {
                text: extractedText,
                confidence: conf,
                words: wordsList,
                engine: 'tesseract',
                langUsed: lang === 'th' ? 'th' : 'th+en',
                fallback: true,
                suspicious,
                warnings: mergeOcrWarnings(
                    ['fallback-engine'],
                    suspicious ? ['suspicious-script-mix'] : []
                ),
                failureReason: extractedText ? null : 'fallback-no-text',
                frameCount: 1,
                agreement: 1
            };
        } catch (tessErr) {
            console.warn('[In-Browser Tesseract.js Error]:', tessErr);
        }
    }

    return emptyOcrResult({
        langUsed: lang === 'th' ? 'th' : 'th+en',
        failureReason: backendFailure ? 'backend-unavailable' : 'no-text',
        warnings: backendFailure ? ['backend-unavailable'] : []
    });
}

// How far below the best frame's confidence another frame can be and still
// be considered "just as trustworthy" for the completeness tie-break below.
const BURST_CONF_BAND = 12;

/**
 * Real-content size of an OCR read: letters + digits only (Latin + the Thai
 * block), so a frame can't win the pick just by hallucinating extra
 * "โ ) 1 ," punctuation fragments. Whitespace and symbols don't count.
 */
function burstContentScore(result) {
    if (!result || typeof result.text !== 'string') return 0;
    const m = result.text.match(/[0-9A-Za-zก-๎๐-๙]/g);
    return m ? m.length : 0;
}

function normalizeBurstText(text) {
    return (typeof text === 'string' ? text : '')
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('en-US');
}

// Braille renders for anything from OCR_CONF_MEDIUM up (matches
// classifyOcrConfidence in js/textProcessor.js). A medium read is shown with
// the amber "อาจมีคำผิด" badge + spoken caveat, not blocked behind a confirm
// button - the target user is blind and cannot verify a plausible-but-wrong
// word (สาย vs สกาย) by looking anyway, so the extra step is friction without
// safety. The confirm gate is reserved for STRUCTURALLY unreliable output.
const OCR_BRAILLE_MIN_CONFIDENCE = 45;

/**
 * Whether a result may actuate Braille directly. It may not when it is
 * structurally unreliable - a fallback-engine read, a cross-script
 * hallucination, a rescued mixed line, a burst without 2/3 agreement, or a
 * confidence so low the text is likely wrong wholesale. Everything else
 * renders (medium confidence carries a visible caveat).
 */
function isOcrResultSafeForBraille(result) {
    if (!result || typeof result.text !== 'string' || !result.text.trim()) return false;
    if (!(typeof result.confidence === 'number') || result.confidence < OCR_BRAILLE_MIN_CONFIDENCE) return false;
    if (result.fallback || result.suspicious || detectSuspiciousOcrText(result.text, result.langUsed)) return false;
    // A rescue is useful evidence, but it also proves the first mixed pass
    // was unstable. Keep it visible and require confirmation rather than
    // turning a corrected guess into an automatic green success.
    if (Number.isFinite(result.rescuedLines) && result.rescuedLines > 0) return false;
    const frameCount = Number.isFinite(result.frameCount) ? result.frameCount : 1;
    const agreement = Number.isFinite(result.agreement) ? result.agreement : 1;
    if (frameCount > 1 && agreement < (2 / 3)) return false;
    return true;
}

/**
 * Picks the best read among burst frames. A 2/3 exact normalized consensus
 * wins first. Without consensus, compare frames inside BURST_CONF_BAND of
 * the top confidence and keep the one with the most real content; that
 * disputed result is marked suspicious and cannot actuate Braille by itself.
 * @param {Array<{text:string,confidence:number,words:Array}>} results
 * @returns {object|null} the chosen result, or null if none had text
 */
function pickBestBurstResult(results) {
    const all = Array.isArray(results) ? results : [];
    const usable = all.filter(r => r && typeof r.text === 'string' && r.text.trim());
    if (usable.length === 0) return null;

    // Exact normalized consensus wins before confidence. This prevents one
    // confidently-wrong frame from beating two matching reads.
    const groups = new Map();
    usable.forEach(result => {
        const key = normalizeBurstText(result.text);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(result);
    });
    const rankedGroups = Array.from(groups.values()).sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return Math.max(...b.map(r => r.confidence || 0)) - Math.max(...a.map(r => r.confidence || 0));
    });
    const consensusGroup = rankedGroups[0];
    const requiredVotes = all.length <= 1 ? 1 : Math.ceil(all.length * 2 / 3);
    const hasConsensus = consensusGroup.length >= requiredVotes;

    let contenders;
    if (hasConsensus) {
        contenders = consensusGroup;
    } else {
        const maxConf = Math.max(...usable.map(r => r.confidence || 0));
        contenders = usable.filter(r => (r.confidence || 0) >= maxConf - BURST_CONF_BAND);
    }

    let best = contenders[0];
    for (const r of contenders) {
        const rScore = burstContentScore(r);
        const bScore = burstContentScore(best);
        if (rScore > bScore || (rScore === bScore && (r.confidence || 0) > (best.confidence || 0))) {
            best = r;
        }
    }
    const agreement = consensusGroup.length / Math.max(1, all.length);
    const warnings = mergeOcrWarnings(
        best.warnings,
        groups.size > 1 ? ['burst-disagreement'] : [],
        usable.length < all.length ? ['unreadable-burst-frame'] : []
    );
    return Object.assign({}, best, {
        frameCount: Math.max(1, all.length),
        agreement,
        suspicious: !!best.suspicious ||
            detectSuspiciousOcrText(best.text, best.langUsed) || !hasConsensus,
        warnings
    });
}

/**
 * Burst helper: runs recognize() on several frames of the same shot and
 * returns the best read. A hand-held capture almost always has one frame
 * sharper than the rest; picking it after the fact is cheaper and more
 * reliable than trying to nail the single perfect moment of the shutter.
 * "Best" = a 2/3 consensus when available, otherwise the most complete
 * among frames of comparable confidence (see pickBestBurstResult).
 * @param {Array<File|Blob>} imageFiles
 * @returns {Promise<{text: string, confidence: number, words: Array, warpedImage?: string}>}
 */
async function recognizeBest(imageFiles, documentSource = 'camera', lang = 'th+en') {
    const files = (imageFiles || []).filter(Boolean);
    if (files.length === 0) return emptyOcrResult({ frameCount: 0, agreement: 0 });
    if (files.length === 1) return recognize(files[0], documentSource, lang);

    const results = await Promise.all(
        files.map(f => recognize(f, documentSource, lang).catch(() => ({ text: '', confidence: 0, words: [] })))
    );

    return pickBestBurstResult(results) || emptyOcrResult({
        langUsed: lang === 'th' ? 'th' : 'th+en',
        frameCount: files.length,
        agreement: 0,
        suspicious: true,
        warnings: ['no-readable-burst-frame']
    });
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
