/* =========================================================================
   BrailBox - Thai Braille cell tables (SINGLE SOURCE OF TRUTH)
   -------------------------------------------------------------------------
   Every glyph the transliteration engine (js/thai-braille.js) can emit is
   defined here, and ONLY here. One entry per glyph:

       'ก': { cells: [[1,2,4,5]], chartRef: 'พยัญชนะ ก' }

   - `cells`   : array of braille cells, each cell an ASCENDING list of raised
                 dot numbers (1..6). Most glyphs are one cell; compound vowels
                 and a few consonants (ฆ ฬ ...) are 2-3 cells.
   - `chartRef`: where this mapping comes from on the official Thai Braille
                 chart (ราชบัณฑิตยสภา). Used by the verify page + a lint test
                 so nothing lands undocumented.

   SOURCE / STATUS
   ---------------
   Dot patterns were decoded from the Unicode braille glyphs published in the
   "Thai and Lao Braille" reference and cross-checked against the values this
   repo already pinned as correct (ก, ท, ห, the four tone marks, ์). They all
   agree. Entries still awaiting a side-by-side check against the user's paper
   chart are tagged  // VERIFY  - see tools/thai-braille-verify.html for a
   visual render of this whole table.
   ========================================================================= */

/* ---------- 44 consonants (พยัญชนะไทย) --------------------------------- */
const THAI_CONSONANTS = {
    'ก': { cells: [[1, 2, 4, 5]],             chartRef: 'พยัญชนะ ก' },
    'ข': { cells: [[1, 3]],                   chartRef: 'พยัญชนะ ข' },
    'ฃ': { cells: [[3, 5, 6], [1, 3]],        chartRef: 'พยัญชนะ ฃ (ข + เครื่องหมายก่อน)' }, // VERIFY
    'ค': { cells: [[1, 3, 6]],                chartRef: 'พยัญชนะ ค' },
    'ฅ': { cells: [[3, 6], [1, 3, 6]],        chartRef: 'พยัญชนะ ฅ' }, // VERIFY
    'ฆ': { cells: [[6], [1, 3, 6]],           chartRef: 'พยัญชนะ ฆ' }, // VERIFY
    'ง': { cells: [[1, 2, 4, 5, 6]],          chartRef: 'พยัญชนะ ง' },
    'จ': { cells: [[2, 4, 5]],                chartRef: 'พยัญชนะ จ' },
    'ฉ': { cells: [[3, 4]],                   chartRef: 'พยัญชนะ ฉ' },
    'ช': { cells: [[3, 4, 6]],                chartRef: 'พยัญชนะ ช' },
    'ซ': { cells: [[2, 3, 4, 6]],             chartRef: 'พยัญชนะ ซ' },
    'ฌ': { cells: [[6], [3, 4, 6]],           chartRef: 'พยัญชนะ ฌ' }, // VERIFY
    'ญ': { cells: [[6], [1, 3, 4, 5, 6]],     chartRef: 'พยัญชนะ ญ' }, // VERIFY
    'ฎ': { cells: [[6], [1, 4, 5]],           chartRef: 'พยัญชนะ ฎ' }, // VERIFY
    'ฏ': { cells: [[6], [1, 2, 5, 6]],        chartRef: 'พยัญชนะ ฏ' }, // VERIFY
    'ฐ': { cells: [[6], [2, 3, 4, 5]],        chartRef: 'พยัญชนะ ฐ' }, // VERIFY
    'ฑ': { cells: [[6], [2, 3, 4, 5, 6]],     chartRef: 'พยัญชนะ ฑ' }, // VERIFY
    'ฒ': { cells: [[3, 6], [2, 3, 4, 5, 6]],  chartRef: 'พยัญชนะ ฒ' }, // VERIFY
    'ณ': { cells: [[6], [1, 3, 4, 5]],        chartRef: 'พยัญชนะ ณ' }, // VERIFY
    'ด': { cells: [[1, 4, 5]],                chartRef: 'พยัญชนะ ด' },
    'ต': { cells: [[1, 2, 5, 6]],             chartRef: 'พยัญชนะ ต' },
    'ถ': { cells: [[2, 3, 4, 5]],             chartRef: 'พยัญชนะ ถ' },
    'ท': { cells: [[2, 3, 4, 5, 6]],          chartRef: 'พยัญชนะ ท' },
    'ธ': { cells: [[3, 5, 6], [2, 3, 4, 5, 6]], chartRef: 'พยัญชนะ ธ' }, // VERIFY
    'น': { cells: [[1, 3, 4, 5]],             chartRef: 'พยัญชนะ น' },
    'บ': { cells: [[1, 2, 3, 6]],             chartRef: 'พยัญชนะ บ' },
    'ป': { cells: [[1, 2, 3, 4, 6]],          chartRef: 'พยัญชนะ ป' },
    'ผ': { cells: [[1, 2, 3, 4]],             chartRef: 'พยัญชนะ ผ' },
    'ฝ': { cells: [[1, 3, 4, 6]],             chartRef: 'พยัญชนะ ฝ' },
    'พ': { cells: [[1, 4, 5, 6]],             chartRef: 'พยัญชนะ พ' },
    'ฟ': { cells: [[1, 2, 4, 6]],             chartRef: 'พยัญชนะ ฟ' },
    'ภ': { cells: [[6], [1, 4, 5, 6]],        chartRef: 'พยัญชนะ ภ' }, // VERIFY
    'ม': { cells: [[1, 3, 4]],                chartRef: 'พยัญชนะ ม' },
    'ย': { cells: [[1, 3, 4, 5, 6]],          chartRef: 'พยัญชนะ ย' },
    'ร': { cells: [[1, 2, 3, 5]],             chartRef: 'พยัญชนะ ร' },
    'ล': { cells: [[1, 2, 3]],                chartRef: 'พยัญชนะ ล' },
    'ว': { cells: [[2, 4, 5, 6]],             chartRef: 'พยัญชนะ ว' },
    'ศ': { cells: [[6], [2, 3, 4]],           chartRef: 'พยัญชนะ ศ' }, // VERIFY
    'ษ': { cells: [[3, 6], [2, 3, 4]],        chartRef: 'พยัญชนะ ษ' }, // VERIFY
    'ส': { cells: [[2, 3, 4]],                chartRef: 'พยัญชนะ ส' },
    'ห': { cells: [[1, 2, 5]],                chartRef: 'พยัญชนะ ห' },
    'ฬ': { cells: [[6], [1, 2, 3]],           chartRef: 'พยัญชนะ ฬ' }, // VERIFY
    'อ': { cells: [[1, 3, 5]],                chartRef: 'พยัญชนะ อ' },
    'ฮ': { cells: [[1, 2, 3, 4, 5, 6]],       chartRef: 'พยัญชนะ ฮ' }
};

/* ---------- Simple vowels (สระเดี่ยว / รูปเดียว) ---------------------- *
 * Keyed by the raw Thai codepoint. The engine positions them relative to
 * the consonant; this table only says "what cell(s)".                    */
const THAI_SIMPLE_VOWELS = {
    'ะ': { cells: [[1]],          chartRef: 'สระ ◌ะ' },              // ะ
    'ั': { cells: [[3, 4, 5]],    chartRef: 'สระ ◌ั (ไม้หันอากาศ)' }, // ั   // VERIFY
    'า': { cells: [[1, 6]],       chartRef: 'สระ ◌า' },              // า   // VERIFY (repo previously had [3,4,5])
    'ำ': { cells: [[1, 3, 5, 6]], chartRef: 'สระ ◌ำ' },              // ำ   // VERIFY
    'ิ': { cells: [[1, 2]],       chartRef: 'สระ ◌ิ' },              // ิ   // VERIFY
    'ี': { cells: [[2, 3]],       chartRef: 'สระ ◌ี' },              // ี   // VERIFY
    'ึ': { cells: [[2, 4, 6]],    chartRef: 'สระ ◌ึ' },              // ึ   // VERIFY
    'ื': { cells: [[2, 6]],       chartRef: 'สระ ◌ื' },              // ื   // VERIFY
    'ุ': { cells: [[1, 4]],       chartRef: 'สระ ◌ุ' },              // ุ   // VERIFY
    'ู': { cells: [[2, 5]],       chartRef: 'สระ ◌ู' },              // ู   // VERIFY
    'ๅ': { cells: [[1, 6]],       chartRef: 'ลากข้าง ◌ๅ' },          // ๅ   // VERIFY
    // Leading vowels as bare codepoints (used when they cannot be folded
    // into a compound key, e.g. malformed input). Real syllables resolve
    // through THAI_COMPOUND_VOWELS instead.
    'เ': { cells: [[1, 2, 4]],    chartRef: 'สระ เ◌' },              // เ
    'แ': { cells: [[1, 2, 6]],    chartRef: 'สระ แ◌' },              // แ
    'โ': { cells: [[2, 4]],       chartRef: 'สระ โ◌' },              // โ
    'ใ': { cells: [[1, 5, 6], [2]], chartRef: 'สระ ใ◌ (ไม้ม้วน)' },   // ใ   // VERIFY
    'ไ': { cells: [[1, 5, 6]],    chartRef: 'สระ ไ◌ (ไม้มลาย)' }      // ไ   // VERIFY
};

/* ---------- Compound / multi-part vowels (สระประสม, รูปหลายส่วน) ------ *
 * Keyed by a CANONICAL form where the consonant slot is written "อ".
 * js/thai-braille.js builds this key from a parsed syllable (leading
 * vowel + above/below vowel + trailing vowel) and looks it up here.
 * These cells are emitted AFTER the initial consonant(s), BEFORE tone. */
const THAI_COMPOUND_VOWELS = {
    'เอะ':   { cells: [[1, 2, 4], [1]],       chartRef: 'สระ เ◌ะ' },      // VERIFY
    'เอ':    { cells: [[1, 2, 4]],            chartRef: 'สระ เ◌' },       // VERIFY
    'แอะ':   { cells: [[1, 2, 6], [1]],       chartRef: 'สระ แ◌ะ' },      // VERIFY
    'แอ':    { cells: [[1, 2, 6]],            chartRef: 'สระ แ◌' },       // VERIFY
    'โอะ':   { cells: [[2, 4], [1]],          chartRef: 'สระ โ◌ะ' },      // VERIFY
    'โอ':    { cells: [[2, 4]],               chartRef: 'สระ โ◌' },       // VERIFY
    'เอาะ':  { cells: [[1, 3, 5], [1]],       chartRef: 'สระ เ◌าะ' },     // VERIFY
    'ออ':    { cells: [[1, 3, 5]],            chartRef: 'สระ ◌อ' },       // VERIFY
    'เออะ':  { cells: [[1, 4, 6], [1]],       chartRef: 'สระ เ◌อะ' },     // VERIFY
    'เออ':   { cells: [[1, 4, 6]],            chartRef: 'สระ เ◌อ' },      // VERIFY
    'เอิอ':  { cells: [[4, 5, 6]],            chartRef: 'สระ เ◌ิ (มีตัวสะกด)' }, // VERIFY
    'เอียะ': { cells: [[1, 2, 3, 5, 6], [1]], chartRef: 'สระ เ◌ียะ' },    // VERIFY
    'เอีย':  { cells: [[1, 2, 3, 5, 6]],      chartRef: 'สระ เ◌ีย' },     // VERIFY
    'เอือะ': { cells: [[1, 2, 3, 4, 5], [1]], chartRef: 'สระ เ◌ือะ' },    // VERIFY
    'เอือ':  { cells: [[1, 2, 3, 4, 5]],      chartRef: 'สระ เ◌ือ' },     // VERIFY
    'อัวะ':  { cells: [[1, 5], [1]],          chartRef: 'สระ ◌ัวะ' },     // VERIFY
    'อัว':   { cells: [[1, 5]],               chartRef: 'สระ ◌ัว' },      // VERIFY
    'อือ':   { cells: [[2, 6]],               chartRef: 'สระ ◌ือ (เช่น มือ คือ)' }, // VERIFY
    'อิอ':   { cells: [[1, 2]],               chartRef: 'สระ ◌ิ + อ' },   // VERIFY
    'อว':    { cells: [[2, 4, 5, 6]],         chartRef: 'สระ ◌ว◌ (ตัว ว กลาง)' }, // VERIFY
    'อำ':    { cells: [[1, 3, 5, 6]],         chartRef: 'สระ ◌ำ' },       // VERIFY
    'ใอ':    { cells: [[1, 5, 6], [2]],       chartRef: 'สระ ใ◌' },       // VERIFY
    'ไอ':    { cells: [[1, 5, 6]],            chartRef: 'สระ ไ◌' },       // VERIFY
    'เอา':   { cells: [[2, 3, 5]],            chartRef: 'สระ เ◌า' },      // VERIFY
    // สระโอะ ที่ลดรูปเมื่อมีตัวสะกด (คน = ค + โอะ + น) - written explicitly in braille
    'โอะ-ลดรูป': { cells: [[2, 4], [1]],      chartRef: 'สระ โ◌ะ (ลดรูป, เขียนเต็มในเบรลล์)' } // VERIFY
};

/* ---------- คำที่มีสระโอะลดรูป (ปิด ไม่มีรูปสระ) ---------------------- *
 * A closed syllable of the shape C(C) + final with no written vowel is
 * pronounced with สระโอะ, which Braille writes out explicitly. Deciding
 * this from spelling alone is ambiguous (อักษรนำ: ขน-ม, สง-บ), so the
 * engine only inserts โอะ when the whole token is one of these known
 * words. The bundled dictionary (js/thai-wordlist.js) widens this later.  */
const REDUCED_O_WORDS = new Set([
    'กก', 'กด', 'กบ', 'กม', 'กล', 'กน',
    'ขน', 'ขม', 'คง', 'คน', 'คด', 'คม', 'ครก',
    'งด', 'งม', 'จก', 'จง', 'จด', 'จน', 'จบ', 'จม',
    'ชก', 'ชด', 'ชน', 'ชม', 'ซก', 'ซด',
    'ดม', 'ตก', 'ตด', 'ตน', 'ตบ', 'ตม',
    'ถก', 'ทด', 'ทน', 'ทบ', 'ธง',
    'นก', 'นม', 'บด', 'บน', 'บม', 'ปก', 'ปด', 'ปน', 'ปม', 'ปล',
    'ผด', 'ผม', 'ฝก', 'ฝน', 'พก', 'พน', 'พบ', 'พม',
    'ฟก', 'ฟด', 'ภพ', 'มด', 'มน', 'มล',
    'ยก', 'ยล', 'รก', 'รด', 'รถ', 'รม',
    'ลง', 'ลด', 'ลบ', 'ลม', 'วน', 'วก',
    'สก', 'สง', 'สด', 'สน', 'สบ', 'สม', 'สล',
    'หก', 'หด', 'หน', 'หม', 'หล', 'อด', 'อก', 'อม', 'ฮก'
]);

/* ---------- ฤ ฤๅ ฦ ฦๅ (used as vowel/consonant hybrids) -------------- */
const THAI_RU_LU = {
    'ฤ':  { cells: [[1, 2, 3, 5], [2]],          chartRef: 'ฤ' },   // VERIFY
    'ฦ':  { cells: [[1, 2, 3], [2]],             chartRef: 'ฦ' },   // VERIFY
    'ฤๅ': { cells: [[1, 2, 3, 5], [2], [1, 6]],  chartRef: 'ฤๅ' },  // VERIFY
    'ฦๅ': { cells: [[1, 2, 3], [2], [1, 6]],     chartRef: 'ฦๅ' }   // VERIFY
};

/* ---------- Tone marks & silent marks (วรรณยุกต์ ฯลฯ) ----------------- *
 * These four + ์ are the values this repo already verified against the
 * Unicode braille glyphs - do NOT change without re-checking the chart. */
const THAI_TONES = {
    '่': { cells: [[3, 5]],       chartRef: 'ไม้เอก ◌่' },        // ่
    '้': { cells: [[2, 5, 6]],    chartRef: 'ไม้โท ◌้' },         // ้
    '๊': { cells: [[2, 3, 5, 6]], chartRef: 'ไม้ตรี ◌๊' },        // ๊
    '๋': { cells: [[2, 3, 6]],    chartRef: 'ไม้จัตวา ◌๋' }       // ๋
};

const THAI_MARKS = {
    '์': { cells: [[3, 5, 6]], chartRef: 'ทัณฑฆาต ◌์' },          // ์
    '็': { cells: [[3]],       chartRef: 'ไม้ไต่คู้ ◌็' },         // ็   // VERIFY
    'ํ': { cells: [[5]],       chartRef: 'นิคหิต ◌ํ' },            // ํ   // VERIFY
    '๎': { cells: [[]],        chartRef: 'ยามักการ ◌๎ (ไม่มีรูปเบรลล์)' } // ๎
};

/* ---------- Digits (ตัวเลข) + เครื่องหมายนำเลข ----------------------- */
const BRAILLE_INDICATORS = {
    number:  { cells: [[3, 4, 5, 6]], chartRef: 'เครื่องหมายนำเลข' },   // VERIFY
    capital: { cells: [[6]],          chartRef: 'เครื่องหมายอักษรตัวใหญ่ (อังกฤษ)' } // VERIFY
};

const DIGITS = {
    '0': { cells: [[2, 4, 5]],    chartRef: 'ตัวเลข 0' },
    '1': { cells: [[1]],          chartRef: 'ตัวเลข 1' },
    '2': { cells: [[1, 2]],       chartRef: 'ตัวเลข 2' },
    '3': { cells: [[1, 4]],       chartRef: 'ตัวเลข 3' },
    '4': { cells: [[1, 4, 5]],    chartRef: 'ตัวเลข 4' },
    '5': { cells: [[1, 5]],       chartRef: 'ตัวเลข 5' },
    '6': { cells: [[1, 2, 4]],    chartRef: 'ตัวเลข 6' },
    '7': { cells: [[1, 2, 4, 5]], chartRef: 'ตัวเลข 7' },
    '8': { cells: [[1, 2, 5]],    chartRef: 'ตัวเลข 8' },
    '9': { cells: [[2, 4]],       chartRef: 'ตัวเลข 9' }
};

// Thai digits ๐-๙ map onto the same braille as 0-9.
const THAI_DIGITS = {
    '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
    '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9'
};

/* ---------- Latin letters (ภาษาอังกฤษ, a-z == A-Z cell) ------------- */
const LATIN_LETTERS = {
    'a': [[1]],       'b': [[1, 2]],    'c': [[1, 4]],       'd': [[1, 4, 5]],
    'e': [[1, 5]],    'f': [[1, 2, 4]], 'g': [[1, 2, 4, 5]], 'h': [[1, 2, 5]],
    'i': [[2, 4]],    'j': [[2, 4, 5]], 'k': [[1, 3]],       'l': [[1, 2, 3]],
    'm': [[1, 3, 4]], 'n': [[1, 3, 4, 5]], 'o': [[1, 3, 5]], 'p': [[1, 2, 3, 4]],
    'q': [[1, 2, 3, 4, 5]], 'r': [[1, 2, 3, 5]], 's': [[2, 3, 4]], 't': [[2, 3, 4, 5]],
    'u': [[1, 3, 6]], 'v': [[1, 2, 3, 6]], 'w': [[2, 4, 5, 6]], 'x': [[1, 3, 4, 6]],
    'y': [[1, 3, 4, 5, 6]], 'z': [[1, 3, 5, 6]]
};

/* ---------- Punctuation & symbols ----------------------------------- *
 * Thai Braille punctuation is not fully shown on the attached chart;
 * values below follow the "Thai and Lao Braille" reference. All VERIFY. */
const PUNCTUATION = {
    ' ':  { cells: [[]],              kind: 'space', chartRef: 'เว้นวรรค' },
    '.':  { cells: [[2, 5, 6]],       chartRef: 'มหัพภาค .' },            // VERIFY
    ',':  { cells: [[2]],             chartRef: 'จุลภาค ,' },             // VERIFY
    '?':  { cells: [[2, 3, 6]],       chartRef: 'ปรัศนี ?' },             // VERIFY
    '!':  { cells: [[2, 3, 5]],       chartRef: 'อัศเจรีย์ !' },          // VERIFY
    ';':  { cells: [[2, 3]],          chartRef: 'อัฒภาค ;' },             // VERIFY
    ':':  { cells: [[2, 5]],          chartRef: 'ทวิภาค :' },             // VERIFY
    '-':  { cells: [[3, 6]],          chartRef: 'ยัติภังค์ -' },          // VERIFY
    '/':  { cells: [[3, 4]],          chartRef: 'ทับ /' },               // VERIFY
    '(':  { cells: [[2, 3, 5, 6]],    chartRef: 'วงเล็บเปิด (' },         // VERIFY
    ')':  { cells: [[2, 3, 5, 6]],    chartRef: 'วงเล็บปิด )' },          // VERIFY
    '"':  { cells: [[2, 3, 6]],       chartRef: 'อัญประกาศ "' },          // VERIFY
    '%':  { cells: [[4], [3, 4], [3, 4]], chartRef: 'เปอร์เซ็นต์ %' },    // VERIFY
    'ฯ': { cells: [[5, 6]],      chartRef: 'ไปยาลน้อย ฯ' },          // ฯ  // VERIFY
    'ๆ': { cells: [[2]],         chartRef: 'ไม้ยมก ๆ' },             // ๆ  // VERIFY
    '฿': { cells: [[4], [2, 3, 4]], chartRef: 'บาท ฿' }              // ฿  // VERIFY
};

/* ---------- exports (browser global + CommonJS for the test runner) -- */
var THAI_BRAILLE_TABLES = {
    THAI_CONSONANTS: THAI_CONSONANTS,
    THAI_SIMPLE_VOWELS: THAI_SIMPLE_VOWELS,
    THAI_COMPOUND_VOWELS: THAI_COMPOUND_VOWELS,
    REDUCED_O_WORDS: REDUCED_O_WORDS,
    THAI_RU_LU: THAI_RU_LU,
    THAI_TONES: THAI_TONES,
    THAI_MARKS: THAI_MARKS,
    BRAILLE_INDICATORS: BRAILLE_INDICATORS,
    DIGITS: DIGITS,
    THAI_DIGITS: THAI_DIGITS,
    LATIN_LETTERS: LATIN_LETTERS,
    PUNCTUATION: PUNCTUATION
};

// A top-level `const` in a classic <script> does NOT become a global
// property - attach explicitly so js/thai-braille.js can find it.
(function (g) { if (g) { g.THAI_BRAILLE_TABLES = THAI_BRAILLE_TABLES; } })(
    typeof globalThis !== 'undefined' ? globalThis
        : (typeof window !== 'undefined' ? window : this));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = THAI_BRAILLE_TABLES;
}
