/* =========================================================================
   Thai Braille transliteration engine - verification suite
   Runs: node tests/test_thai_braille_transliteration.js
   ========================================================================= */

const path = require('path');
const assert = require('assert');

const tables = require(path.resolve(__dirname, '../js/thai-braille-tables.js'));
const wordlist = require(path.resolve(__dirname, '../js/thai-wordlist.js'));
const engine = require(path.resolve(__dirname, '../js/thai-braille.js'));
const CASES = require(path.resolve(__dirname, 'fixtures/thai-braille-chart-cases.js'));
const HAS_DICT = !!(wordlist && wordlist.set && wordlist.size > 100);

const { textToBrailleCells, paginateBrailleCells } = engine;

// Highest engine stage implemented so far. Fixtures tagged with a higher
// `stage` are reported as PENDING, not failures. Bump as stages land.
const CURRENT_STAGE = 4;

let total = 0, passed = 0, failed = 0, pending = 0;
function test(name, fn) {
    total++;
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n         ${e.message}`); failed++; }
}
function pend(name) { total++; pending++; console.log(`  [PEND] ${name} (needs engine stage > ${CURRENT_STAGE})`); }

const dots = cells => cells.map(c => (c.dots || []).join('')).join('|');
const expDots = groups => groups.map(g => g.slice().sort((a, b) => a - b).join('')).join('|');

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE A: module load & shape ---');

test('tables expose all categories', () => {
    ['THAI_CONSONANTS', 'THAI_SIMPLE_VOWELS', 'THAI_COMPOUND_VOWELS', 'THAI_TONES',
     'BRAILLE_INDICATORS', 'DIGITS', 'LATIN_LETTERS', 'PUNCTUATION'].forEach(k => {
        assert(tables[k] && typeof tables[k] === 'object', `missing ${k}`);
    });
});

test('THAI_CONSONANTS has 44 entries', () => {
    assert.strictEqual(Object.keys(tables.THAI_CONSONANTS).length, 44,
        `got ${Object.keys(tables.THAI_CONSONANTS).length}`);
});

test('every table entry has cells + non-empty chartRef', () => {
    const groups = ['THAI_CONSONANTS', 'THAI_SIMPLE_VOWELS', 'THAI_COMPOUND_VOWELS',
        'THAI_RU_LU', 'THAI_TONES', 'THAI_MARKS', 'DIGITS', 'PUNCTUATION'];
    for (const g of groups) {
        for (const [k, v] of Object.entries(tables[g])) {
            assert(Array.isArray(v.cells), `${g}['${k}'] has no cells[]`);
            assert(typeof v.chartRef === 'string' && v.chartRef.length > 0,
                `${g}['${k}'] has no chartRef`);
            v.cells.forEach(cell => {
                assert(Array.isArray(cell), `${g}['${k}'] cell not an array`);
                cell.forEach(d => assert(d >= 1 && d <= 6, `${g}['${k}'] bad dot ${d}`));
            });
        }
    }
});

test('engine exports functions', () => {
    assert.strictEqual(typeof textToBrailleCells, 'function');
    assert.strictEqual(typeof paginateBrailleCells, 'function');
});

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE B: totality (never throw, always an array) ---');

['', 'ก', 'ๆ', '่', '้าง', 'ก'.repeat(500), '😀', 'ก😀ข', 'A1ก .', null, undefined]
    .forEach(inp => {
        test(`textToBrailleCells(${JSON.stringify(inp)}) -> array`, () => {
            const out = textToBrailleCells(inp);
            assert(Array.isArray(out));
            out.forEach(c => {
                assert(Array.isArray(c.dots));
                assert(typeof c.source === 'string');
                assert.deepStrictEqual(c.activeDots, c.dots, 'activeDots must alias dots');
                assert.strictEqual(c.char, c.source, 'char must alias source');
                assert(typeof c.label === 'string', 'cell must carry a display label');
            });
        });
    });

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE C: chart fixtures (end-to-end) ---');

for (const c of CASES) {
    if (c.pages) continue; // pagination has its own suite
    const label = `${c.section}: ${JSON.stringify(c.input)} (${c.chartRef})`;
    if ((c.stage || 1) > CURRENT_STAGE) { pend(label); continue; }
    if (c.spaces !== undefined) {
        if (!HAS_DICT) { pend(label + ' [needs wordlist]'); continue; }
        test(label, () => {
            const n = textToBrailleCells(c.input).filter(x => x.kind === 'space').length;
            assert.strictEqual(n, c.spaces, `expected ${c.spaces} space cells, got ${n}`);
        });
        continue;
    }
    if (c.needsDict && !HAS_DICT) { pend(label + ' [needs wordlist]'); continue; }
    test(label, () => {
        const got = dots(textToBrailleCells(c.input));
        assert.strictEqual(got, expDots(c.cells));
    });
}

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE D: table <-> fixture agreement (independent transcription) ---');

for (const c of CASES) {
    if (c.section !== 'consonant' || c.input.length !== 1) continue;
    test(`table['${c.input}'] matches fixture`, () => {
        const entry = tables.THAI_CONSONANTS[c.input];
        assert(entry, `no table entry for ${c.input}`);
        assert.strictEqual(expDots(entry.cells), expDots(c.cells));
    });
}

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE E: pagination by braille-cell count ---');

for (const c of CASES) {
    if (!c.pages) continue;
    test(`paginate ${JSON.stringify(c.input)} -> ${JSON.stringify(c.pages)}`, () => {
        const pages = paginateBrailleCells(textToBrailleCells(c.input), 14);
        assert.deepStrictEqual(pages.map(p => p.cells.length), c.pages);
        pages.forEach(p => assert(p.cells.length <= 14, 'page exceeds 14 cells'));
        assert.strictEqual(pages.map(p => p.text).join(''),
            textToBrailleCells(c.input).map(x => x.source).join(''),
            'page .text must round-trip the sources');
    });
}

test('empty input -> exactly one empty page', () => {
    const pages = paginateBrailleCells(textToBrailleCells(''), 14);
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].cells.length, 0);
});

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE F: cell display label (bare combining marks) ---');

test('a bare above/below vowel or tone cell is labelled with a dotted circle', () => {
    const marks = textToBrailleCells('พิตต้า');
    const vowel = marks.find(c => c.source === 'ิ');
    const tone = marks.find(c => c.source === '้');
    assert(vowel && vowel.label === '◌ิ', `sara i cell label should be ◌ิ, got ${vowel && vowel.label}`);
    assert(tone && tone.label === '◌้', `mai tho cell label should be ◌้, got ${tone && tone.label}`);
    // source stays the raw grapheme (used for OLED text + speech)
    assert.strictEqual(vowel.source, 'ิ');
    assert.strictEqual(tone.source, '้');
});

test('a spacing letter/vowel keeps its plain label', () => {
    const cells = textToBrailleCells('กา');
    assert.strictEqual(cells[0].label, 'ก');
    assert.strictEqual(cells.find(c => c.source === 'า').label, 'า');
});

test('page .text is built from source, never the dotted-circle label', () => {
    const pages = paginateBrailleCells(textToBrailleCells('ก่อน'), 14);
    assert(!pages[0].text.includes('◌'), 'OLED/speech text must not contain the display dotted circle');
});

/* ------------------------------------------------------------------ */
console.log('\n--- SUITE G: name segmentation (a spaceless OCR run is not over-split) ---');

if (!HAS_DICT) {
    pend('name segmentation [needs wordlist]');
} else {
    [
        ['พิตต้า', 0], ['ฐิติพร', 0], ['สกาย', 0], ['โชกุน', 0], ['สมชาย', 0], ['คิม', 0],
        // real phrases still get their word breaks
        ['ผมชอบกินข้าว', 3], ['สวัสดีครับ', 1], ['ยินดีต้อนรับ', 1], ['เขาไปโรงเรียน', 2],
    ].forEach(([input, want]) => {
        test(`segment ${JSON.stringify(input)} -> ${want} space cell(s)`, () => {
            const n = textToBrailleCells(input).filter(c => c.kind === 'space').length;
            assert.strictEqual(n, want, `expected ${want} spaces, got ${n}`);
        });
    });
}

/* ------------------------------------------------------------------ */
console.log(`\n=== Thai Braille suite: ${passed}/${total} passed, ${failed} failed, ${pending} pending ===\n`);
process.exit(failed > 0 ? 1 : 0);
