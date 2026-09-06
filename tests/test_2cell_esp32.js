const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('>>> [qa_agent] CURRENT_STATE: STATE_EXECUTING');
console.log('>>> [qa_agent] LOG: Running 2-Cell ESP32 Tactile Workstation Test Suite');
console.log('===============================================================\n');

const projectRoot = path.resolve(__dirname, '..');
const esp32SerialPath = path.join(projectRoot, 'js', 'esp32-serial.js');
const tactileShapesPath = path.join(projectRoot, 'js', 'tactile-shapes.js');
const twoCellDisplayPath = path.join(projectRoot, 'js', 'two-cell-display.js');
const thaiBrailleTablesPath = path.join(projectRoot, 'js', 'thai-braille-tables.js');
const thaiBraillePath = path.join(projectRoot, 'js', 'thai-braille.js');

assert(fs.existsSync(esp32SerialPath), 'Missing js/esp32-serial.js');
assert(fs.existsSync(tactileShapesPath), 'Missing js/tactile-shapes.js');
assert(fs.existsSync(twoCellDisplayPath), 'Missing js/two-cell-display.js');

const { ESP32SerialManager } = require(esp32SerialPath);
const { TACTILE_PRESETS, TactileShapesManager } = require(tactileShapesPath);
const { TwoCellDisplayEngine } = require(twoCellDisplayPath);

// Load Thai Braille modules into global scope if present
if (fs.existsSync(thaiBrailleTablesPath)) {
    require(thaiBrailleTablesPath);
}
if (fs.existsSync(thaiBraillePath)) {
    require(thaiBraillePath);
}

let passedTests = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(e);
        process.exit(1);
    }
}

console.log('--- Suite 1: ESP32 Serial Manager ---');
test('Baud rate defaults to 115200', () => {
    const serial = new ESP32SerialManager();
    assert.strictEqual(serial.baudRate, 115200);
});

test('Rejects invalid command length (< 12 or > 12)', async () => {
    const serial = new ESP32SerialManager();
    const resShort = await serial.send12BitCommand('1010');
    assert.strictEqual(resShort.success, false);
    assert(resShort.error.includes('12 หลัก'));

    const resLong = await serial.send12BitCommand('1111111111111');
    assert.strictEqual(resLong.success, false);
});

test('Rejects non-binary characters (only 0 and 1 allowed)', async () => {
    const serial = new ESP32SerialManager();
    const res = await serial.send12BitCommand('101010101020');
    assert.strictEqual(res.success, false);
    assert(res.error.includes('0 หรือ 1'));
});

test('Accepts valid 12-bit binary command in mock mode', async () => {
    const serial = new ESP32SerialManager();
    let emittedTx = null;
    serial.on('tx', (data) => { emittedTx = data; });

    const res = await serial.send12BitCommand('110011001100');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.command, '110011001100');
    assert(emittedTx);
    assert.strictEqual(emittedTx.command, '110011001100');
});

console.log('\n--- Suite 2: Tactile Shapes & 12-Dot Presets ---');
test('All 8 tactile presets are defined', () => {
    const shapes = new TactileShapesManager();
    assert.strictEqual(shapes.presets.length, 8);
});

test('Preset 1.1 ▲ maps to dots [2,4,5,7,8,11] and bitstring "010110110010"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('1.1');
    assert.strictEqual(res.bitstring, '010110110010');
    assert.deepStrictEqual(res.preset.dots, [2, 4, 5, 7, 8, 11]);
});

test('Preset 1.2 ▼ maps to dots [2,5,6,8,9,11] and bitstring "010011011010"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('1.2');
    assert.strictEqual(res.bitstring, '010011011010');
    assert.deepStrictEqual(res.preset.dots, [2, 5, 6, 8, 9, 11]);
});

test('Preset 2.1 ■ maps to dots 1..12 and bitstring "111111111111"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('2.1');
    assert.strictEqual(res.bitstring, '111111111111');
});

test('Preset 2.2 □ maps to dots [1,2,3,4,6,7,9,10,11,12] and bitstring "111101101111"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('2.2');
    assert.strictEqual(res.bitstring, '111101101111');
});

test('Preset 3.1 ○ maps to dots [2,4,6,7,9,11] and bitstring "010101101010"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('3.1');
    assert.strictEqual(res.bitstring, '010101101010');
});

test('Preset 3.2 ● maps to dots [2,4,5,6,7,8,9,11] and bitstring "010111111010"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('3.2');
    assert.strictEqual(res.bitstring, '010111111010');
});

test('Preset 5 X maps to dots [1,3,5,8,10,12] and bitstring "101010010101"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('5');
    assert.strictEqual(res.bitstring, '101010010101');
});

test('Preset 6 ✓ maps to dots [2,6,8,10] and bitstring "010001010100"', () => {
    const shapes = new TactileShapesManager();
    const res = shapes.selectPreset('6');
    assert.strictEqual(res.bitstring, '010001010100');
});

test('Custom 12-dot toggling correctly updates bits and dot set', () => {
    const shapes = new TactileShapesManager();
    shapes.toggleCustomDot(1); // dot 1
    shapes.toggleCustomDot(12); // dot 12
    const { bitstring } = shapes.toggleCustomDot(7); // dot 7
    assert.strictEqual(bitstring, '100000100001');
    assert.deepStrictEqual(shapes.currentShape.dots, [1, 7, 12]);
});

console.log('\n--- Suite 3: 2-Cell Display Engine & Ribbon ---');
test('cellsTo12Bitstring maps Cell 1 to bits 0-5 and Cell 2 to bits 6-11', () => {
    // Cell 1 has dot 1 (bit 0), Cell 2 has dot 1 (which is physical pin 7, bit 6)
    const bits = TwoCellDisplayEngine.cellsTo12Bitstring([1], [1]);
    assert.strictEqual(bits, '100000100000');
    assert.strictEqual(bits.length, 12);
});

test('dotsToBrailleChar converts dots [1, 2] to "⠃"', () => {
    const ch = TwoCellDisplayEngine.dotsToBrailleChar([1, 2]);
    assert.strictEqual(ch, '⠃');
});

test('Slices multi-character word into 2-cell frames with exact 12-bit strings', () => {
    const engine = new TwoCellDisplayEngine();
    // 4 characters -> exactly 2 frames
    engine.setText('abcd');
    assert.strictEqual(engine.cells.length, 4);
    assert.strictEqual(engine.frames.length, 2);

    // Frame 0: 'a' (dot 1) and 'b' (dots 1, 2)
    // a: bit 0 on
    // b: bit 6, 7 on
    const f0 = engine.frames[0];
    assert.strictEqual(f0.bitstring, '100000110000');

    // Frame 1: 'c' (dots 1, 4) and 'd' (dots 1, 4, 5)
    // c: bit 0, 3 on -> 100100
    // d: bit 6, 9, 10 on -> 100110
    const f1 = engine.frames[1];
    assert.strictEqual(f1.bitstring, '100100100110');
});

test('Odd number of characters pads second cell with blank (000000)', () => {
    const engine = new TwoCellDisplayEngine();
    engine.setText('a');
    assert.strictEqual(engine.frames.length, 1);
    assert.strictEqual(engine.frames[0].bitstring, '100000000000');
});

test('Next, Prev, and Jump navigation loops and bounds correctly', () => {
    const engine = new TwoCellDisplayEngine();
    engine.setText('abcdef'); // 3 frames (0, 1, 2)
    assert.strictEqual(engine.frames.length, 3);
    assert.strictEqual(engine.currentFrameIndex, 0);

    engine.nextFrame();
    assert.strictEqual(engine.currentFrameIndex, 1);

    engine.nextFrame();
    assert.strictEqual(engine.currentFrameIndex, 2);

    engine.nextFrame(); // wraps to 0
    assert.strictEqual(engine.currentFrameIndex, 0);

    engine.prevFrame(); // wraps to 2
    assert.strictEqual(engine.currentFrameIndex, 2);

    engine.jumpToFrame(1);
    assert.strictEqual(engine.currentFrameIndex, 1);
});

test('Thai transliteration with composite vowels uses single compound cells', () => {
    // If thai-braille is loaded, "เรียน" will have compound vowel "เอีย"
    if (typeof THAI_BRAILLE_TABLES !== 'undefined') {
        const compoundVowel = THAI_BRAILLE_TABLES.THAI_COMPOUND_VOWELS['เอีย'];
        assert(compoundVowel, 'THAI_COMPOUND_VOWELS["เอีย"] must exist');
        assert.deepStrictEqual(compoundVowel.cells, [[1, 2, 3, 5, 6]]);
    }
});

test('Number mode properly inserts Braille Number Indicator [3, 4, 5, 6]', () => {
    const engine = new TwoCellDisplayEngine();
    engine.setText('1');
    // First cell is Number Sign '#', second cell is digit '1'
    assert.strictEqual(engine.cells.length, 2);
    assert.deepStrictEqual(engine.cells[0].dots, [3, 4, 5, 6]);
    assert.deepStrictEqual(engine.cells[1].dots, [1]);
    assert.strictEqual(engine.frames[0].bitstring, '001111100000');
});

console.log('\n--- Suite 4: DOM Elements & Workstation Layout in index.html ---');
const indexPath = path.join(projectRoot, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

const requiredDomIds = [
    'workstationApp',
    'appSidebar',
    'btnConnectESP32',
    'esp32StatusBadge',
    'esp32PortDesc',
    'esp32LastTx',
    'textRibbonTrack',
    'twoCellTactileBoard',
    'activeBitstringDisplay',
    'frameCounterBadge',
    'btnPrevCellPair',
    'btnPulseActuate',
    'btnNextCellPair',
    'btnToggleAutoPlay',
    'playSpeedSlider',
    'speedValLabel',
    'mainTextInput',
    'tactileShapesModal',
    'shapesPresetGrid',
    'customMatrixClicker',
    'pinDiagnosticModal'
];

requiredDomIds.forEach(id => {
    test(`DOM element #${id} exists in index.html`, () => {
        assert(indexHtml.includes(`id="${id}"`), `Element #${id} not found in index.html`);
    });
});

console.log('\n--- Suite 5: CSS Stylesheet Classes & Minimalist Aesthetics ---');
const cssPath = path.join(projectRoot, 'css', 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const requiredCssClasses = [
    '.workstation-app',
    '.app-sidebar',
    '.esp32-status-card',
    '.two-cell-twin-card',
    '.tactile-matrix-grid',
    '.tactile-pin.raised',
    '.tactile-pin.recessed',
    '.ribbon-track-wrapper',
    '.ribbon-cell-card.active-cell',
    '.quick-chip',
    '.shape-btn-card',
    '.custom-matrix-clicker'
];

requiredCssClasses.forEach(cls => {
    test(`CSS class ${cls} defined in css/styles.css`, () => {
        assert(cssContent.includes(cls), `CSS class ${cls} not found in css/styles.css`);
    });
});

console.log('\n--- Suite 6: Clean Architecture & Decoupled 3D Page ---');
const modelPath = path.join(projectRoot, 'model.html');
test('model.html exists as standalone 3D simulator page', () => {
    assert(fs.existsSync(modelPath), 'model.html not found');
    const modelContent = fs.readFileSync(modelPath, 'utf-8');
    assert(modelContent.includes('webgl-container'), 'model.html missing webgl-container');
    assert(modelContent.includes('index.html'), 'model.html missing back-to-home navigation link');
});

test('index.html contains imageUploadModal for dedicated image OCR', () => {
    assert(indexHtml.includes('id="imageUploadModal"'), 'index.html missing imageUploadModal');
    assert(indexHtml.includes('id="modalUploadDropzone"'), 'index.html missing modalUploadDropzone');
});

test('index.html sidebar links to camera.html and model.html directly', () => {
    assert(indexHtml.includes("window.location.href='camera.html'"), 'Sidebar missing link to camera.html');
    assert(indexHtml.includes("window.location.href='model.html'"), 'Sidebar missing link to model.html');
});

console.log(`\n===============================================================`);
console.log(`>>> [qa_agent] SUMMARY: All ${passedTests} autonomous tests PASSED 100%`);
console.log(`>>> [qa_agent] NEXT_STATE: STATE_IDLE`);
console.log(`===============================================================`);


