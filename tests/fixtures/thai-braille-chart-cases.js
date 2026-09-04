/* =========================================================================
   Thai Braille transliteration - test corpus
   -------------------------------------------------------------------------
   Hand-transcribed from the official Thai Braille chart (ราชบัณฑิตยสภา),
   INDEPENDENTLY of js/thai-braille-tables.js. The transliteration test
   asserts table-output == fixture, so a transcription mistake has to be
   made identically in both places to slip through.

   Each case:
     input    : the Unicode string fed to textToBrailleCells()
     cells    : expected braille cells, each an ascending dot list ([] = blank)
     section  : grouping for the report
     chartRef : where on the chart this comes from
     needsDict: (optional) only checked when js/thai-wordlist.js is loaded
     stage    : (optional) minimum engine stage that should pass this
                (1 = char map only, 3 = reorder/compound, 4 = syllable/spacing)
   ========================================================================= */

module.exports = [
    /* ---- consonants (พยัญชนะไทย) - one cell unless noted --------------- */
    { section: 'consonant', stage: 1, input: 'ก', cells: [[1, 2, 4, 5]], chartRef: 'ก' },
    { section: 'consonant', stage: 1, input: 'ข', cells: [[1, 3]], chartRef: 'ข' },
    { section: 'consonant', stage: 1, input: 'ค', cells: [[1, 3, 6]], chartRef: 'ค' },
    { section: 'consonant', stage: 1, input: 'ง', cells: [[1, 2, 4, 5, 6]], chartRef: 'ง' },
    { section: 'consonant', stage: 1, input: 'จ', cells: [[2, 4, 5]], chartRef: 'จ' },
    { section: 'consonant', stage: 1, input: 'ฉ', cells: [[3, 4]], chartRef: 'ฉ' },
    { section: 'consonant', stage: 1, input: 'ช', cells: [[3, 4, 6]], chartRef: 'ช' },
    { section: 'consonant', stage: 1, input: 'ซ', cells: [[2, 3, 4, 6]], chartRef: 'ซ' },
    { section: 'consonant', stage: 1, input: 'ญ', cells: [[6], [1, 3, 4, 5, 6]], chartRef: 'ญ' },
    { section: 'consonant', stage: 1, input: 'ด', cells: [[1, 4, 5]], chartRef: 'ด' },
    { section: 'consonant', stage: 1, input: 'ต', cells: [[1, 2, 5, 6]], chartRef: 'ต' },
    { section: 'consonant', stage: 1, input: 'ถ', cells: [[2, 3, 4, 5]], chartRef: 'ถ' },
    { section: 'consonant', stage: 1, input: 'ท', cells: [[2, 3, 4, 5, 6]], chartRef: 'ท' },
    { section: 'consonant', stage: 1, input: 'น', cells: [[1, 3, 4, 5]], chartRef: 'น' },
    { section: 'consonant', stage: 1, input: 'บ', cells: [[1, 2, 3, 6]], chartRef: 'บ' },
    { section: 'consonant', stage: 1, input: 'ป', cells: [[1, 2, 3, 4, 6]], chartRef: 'ป' },
    { section: 'consonant', stage: 1, input: 'ผ', cells: [[1, 2, 3, 4]], chartRef: 'ผ' },
    { section: 'consonant', stage: 1, input: 'ฝ', cells: [[1, 3, 4, 6]], chartRef: 'ฝ' },
    { section: 'consonant', stage: 1, input: 'พ', cells: [[1, 4, 5, 6]], chartRef: 'พ' },
    { section: 'consonant', stage: 1, input: 'ฟ', cells: [[1, 2, 4, 6]], chartRef: 'ฟ' },
    { section: 'consonant', stage: 1, input: 'ม', cells: [[1, 3, 4]], chartRef: 'ม' },
    { section: 'consonant', stage: 1, input: 'ย', cells: [[1, 3, 4, 5, 6]], chartRef: 'ย' },
    { section: 'consonant', stage: 1, input: 'ร', cells: [[1, 2, 3, 5]], chartRef: 'ร' },
    { section: 'consonant', stage: 1, input: 'ล', cells: [[1, 2, 3]], chartRef: 'ล' },
    { section: 'consonant', stage: 1, input: 'ว', cells: [[2, 4, 5, 6]], chartRef: 'ว' },
    { section: 'consonant', stage: 1, input: 'ส', cells: [[2, 3, 4]], chartRef: 'ส' },
    { section: 'consonant', stage: 1, input: 'ห', cells: [[1, 2, 5]], chartRef: 'ห' },
    { section: 'consonant', stage: 1, input: 'อ', cells: [[1, 3, 5]], chartRef: 'อ' },
    { section: 'consonant', stage: 1, input: 'ฮ', cells: [[1, 2, 3, 4, 5, 6]], chartRef: 'ฮ' },
    // ท vs ห regression guard (this repo once shipped ท == ห)
    { section: 'consonant', stage: 1, input: 'ทห', cells: [[2, 3, 4, 5, 6], [1, 2, 5]], chartRef: 'ท ≠ ห' },

    /* ---- simple vowels (สระ - รูปเดียว) ------------------------------- */
    { section: 'simple-vowel', stage: 1, input: 'กะ', cells: [[1, 2, 4, 5], [1]], chartRef: 'สระ ◌ะ' },
    { section: 'simple-vowel', stage: 1, input: 'กา', cells: [[1, 2, 4, 5], [1, 6]], chartRef: 'สระ ◌า' },
    { section: 'simple-vowel', stage: 1, input: 'กิ', cells: [[1, 2, 4, 5], [1, 2]], chartRef: 'สระ ◌ิ' },
    { section: 'simple-vowel', stage: 1, input: 'กี', cells: [[1, 2, 4, 5], [2, 3]], chartRef: 'สระ ◌ี' },
    { section: 'simple-vowel', stage: 1, input: 'กุ', cells: [[1, 2, 4, 5], [1, 4]], chartRef: 'สระ ◌ุ' },
    { section: 'simple-vowel', stage: 1, input: 'กู', cells: [[1, 2, 4, 5], [2, 5]], chartRef: 'สระ ◌ู' },

    /* ---- tone marks (วรรณยุกต์) - values pinned by this repo ---------- */
    { section: 'tone', stage: 1, input: 'ก่', cells: [[1, 2, 4, 5], [3, 5]], chartRef: 'ไม้เอก' },
    { section: 'tone', stage: 1, input: 'ก้', cells: [[1, 2, 4, 5], [2, 5, 6]], chartRef: 'ไม้โท' },
    { section: 'tone', stage: 1, input: 'ก๊', cells: [[1, 2, 4, 5], [2, 3, 5, 6]], chartRef: 'ไม้ตรี' },
    { section: 'tone', stage: 1, input: 'ก๋', cells: [[1, 2, 4, 5], [2, 3, 6]], chartRef: 'ไม้จัตวา' },
    { section: 'mark', stage: 1, input: 'ก์', cells: [[1, 2, 4, 5], [3, 5, 6]], chartRef: 'ทัณฑฆาต' },

    /* ---- digits + number sign (ตัวเลข + เครื่องหมายนำเลข) ------------- */
    { section: 'digits', stage: 1, input: '1', cells: [[3, 4, 5, 6], [1]], chartRef: 'เลข 1' },
    { section: 'digits', stage: 1, input: '2568', cells: [[3, 4, 5, 6], [1, 2], [1, 5], [1, 2, 4], [1, 2, 5]], chartRef: 'เลข 2568' },
    { section: 'digits', stage: 1, input: '๒๕๖๘', cells: [[3, 4, 5, 6], [1, 2], [1, 5], [1, 2, 4], [1, 2, 5]], chartRef: 'เลขไทย ๒๕๖๘' },

    /* ---- Latin + capital sign --------------------------------------- */
    { section: 'latin', stage: 1, input: 'cat', cells: [[1, 4], [1], [2, 3, 4, 5]], chartRef: 'a-z == A-Z cell' },
    { section: 'latin', stage: 1, input: 'AB', cells: [[6], [1], [6], [1, 2]], chartRef: 'เครื่องหมายตัวใหญ่' },

    /* ---- reordering (สระหน้า ย้ายหลังพยัญชนะ) - engine stage 3 ------- */
    { section: 'reorder', stage: 3, input: 'เก', cells: [[1, 2, 4, 5], [1, 2, 4]], chartRef: 'สระ เ◌ (เขียนหลัง ก)' },
    { section: 'reorder', stage: 3, input: 'แก', cells: [[1, 2, 4, 5], [1, 2, 6]], chartRef: 'สระ แ◌' },
    { section: 'reorder', stage: 3, input: 'โต', cells: [[1, 2, 5, 6], [2, 4]], chartRef: 'สระ โ◌' },
    { section: 'reorder', stage: 3, input: 'ไก', cells: [[1, 2, 4, 5], [1, 5, 6]], chartRef: 'สระ ไ◌' },
    { section: 'tone-reorder', stage: 3, input: 'เก่ง', cells: [[1, 2, 4, 5], [1, 2, 4], [1, 2, 4, 5, 6], [3, 5]], chartRef: 'เ + ก + สะกด ง + ไม้เอก (ไม้เอกท้ายสุด)' },

    /* ---- compound vowels (สระประสมหลายส่วน) - engine stage 3 -------- */
    { section: 'compound-vowel', stage: 3, input: 'เกาะ', cells: [[1, 2, 4, 5], [1, 3, 5], [1]], chartRef: 'สระ เ◌าะ' },
    { section: 'compound-vowel', stage: 3, input: 'เสีย', cells: [[2, 3, 4], [1, 2, 3, 5, 6]], chartRef: 'สระ เ◌ีย' },
    { section: 'compound-vowel', stage: 3, input: 'เรือ', cells: [[1, 2, 3, 5], [1, 2, 3, 4, 5]], chartRef: 'สระ เ◌ือ' },
    { section: 'compound-vowel', stage: 3, input: 'ตัว', cells: [[1, 2, 5, 6], [1, 5]], chartRef: 'สระ ◌ัว' },
    { section: 'compound-vowel', stage: 3, input: 'น้ำ', cells: [[1, 3, 4, 5], [1, 3, 5, 6], [2, 5, 6]], chartRef: 'สระ ◌ำ + ไม้โท' },

    /* ---- reduced สระโอะ (ลดรูป) - engine stage 4 ------------------- */
    { section: 'reduced-o', stage: 4, input: 'คน', cells: [[1, 3, 6], [2, 4], [1], [1, 3, 4, 5]], chartRef: 'คน = ค + โอะ + น' },
    { section: 'reduced-o', stage: 4, input: 'จบ', cells: [[2, 4, 5], [2, 4], [1], [1, 2, 3, 6]], chartRef: 'จบ = จ + โอะ + บ' },

    /* ---- word spacing (เว้นวรรคระหว่างคำ) - needs dictionary -------- *
     * `spaces` = number of blank (space) cells the engine should insert.   */
    { section: 'word-space', stage: 4, needsDict: true, input: 'ยินดีต้อนรับ', spaces: 1, chartRef: 'ยินดี | ต้อนรับ' },
    { section: 'word-space', stage: 4, needsDict: true, input: 'สวัสดีครับ', spaces: 1, chartRef: 'สวัสดี | ครับ' },
    { section: 'word-space', stage: 4, needsDict: true, input: 'ผมชอบกินข้าว', spaces: 3, chartRef: 'ผม | ชอบ | กิน | ข้าว' },
    { section: 'word-space', stage: 4, needsDict: true, input: 'เขาไปโรงเรียน', spaces: 2, chartRef: 'เขา | ไป | โรงเรียน' },

    /* ---- pagination (แบ่งหน้า 14 เซลล์ต่อหน้า) --------------------- */
    // lowercase Latin: 1 cell/char, no number/capital signs, no dictionary
    { section: 'pagination', stage: 1, input: 'abcdefghijklmn', pages: [14] },
    { section: 'pagination', stage: 1, input: 'abcdefghijklmno', pages: [14, 1] }
];
