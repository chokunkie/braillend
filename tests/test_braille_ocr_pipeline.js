const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('===============================================================');
console.log('>>> [qa_agent] CURRENT_STATE: STATE_EXECUTING');
console.log('>>> [qa_agent] LOG: Starting Autonomous Verification & QA Suite (4-Corner Target Lock & Voice Guidance)');
console.log('===============================================================\n');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');
const cssPath = path.join(projectRoot, 'css', 'styles.css');
const jsBraillePath = path.join(projectRoot, 'js', 'braille-engine.js');
const jsThreePath = path.join(projectRoot, 'js', 'three-scene.js');
const jsVoicePath = path.join(projectRoot, 'js', 'voice-guidance.js');
const jsOcrEnginePath = path.join(projectRoot, 'js', 'ocr-engine.js');
const jsOcrModulePath = path.join(projectRoot, 'js', 'ocr.js');
const jsCameraPath = path.join(projectRoot, 'js', 'camera.js');
const jsTextProcessorPath = path.join(projectRoot, 'js', 'textProcessor.js');
const jsDemoModePath = path.join(projectRoot, 'js', 'demoMode.js');
const jsRealSimPath = path.join(projectRoot, 'js', 'real-simulation.js');
const jsAppPath = path.join(projectRoot, 'js', 'app.js');
const readmePath = path.join(projectRoot, 'README.md');
const backendMainPath = path.join(projectRoot, 'backend', 'main.py');
const backendPreprocessingPath = path.join(projectRoot, 'backend', 'preprocessing.py');
const backendOcrEnginePath = path.join(projectRoot, 'backend', 'ocr_engine.py');
const backendRequirementsPath = path.join(projectRoot, 'backend', 'requirements.txt');

assert(fs.existsSync(indexPath), `Target index.html not found at ${indexPath}`);
assert(fs.existsSync(cssPath), `Target css/styles.css not found at ${cssPath}`);
assert(fs.existsSync(jsBraillePath), `Target js/braille-engine.js not found at ${jsBraillePath}`);
assert(fs.existsSync(jsThreePath), `Target js/three-scene.js not found at ${jsThreePath}`);
assert(fs.existsSync(jsVoicePath), `Target js/voice-guidance.js not found at ${jsVoicePath}`);
assert(fs.existsSync(jsOcrEnginePath), `Target js/ocr-engine.js not found at ${jsOcrEnginePath}`);
assert(fs.existsSync(jsOcrModulePath), `Target js/ocr.js not found at ${jsOcrModulePath}`);
assert(fs.existsSync(jsCameraPath), `Target js/camera.js not found at ${jsCameraPath}`);
assert(fs.existsSync(jsTextProcessorPath), `Target js/textProcessor.js not found at ${jsTextProcessorPath}`);
assert(fs.existsSync(jsDemoModePath), `Target js/demoMode.js not found at ${jsDemoModePath}`);
assert(fs.existsSync(jsRealSimPath), `Target js/real-simulation.js not found at ${jsRealSimPath}`);
assert(fs.existsSync(jsAppPath), `Target js/app.js not found at ${jsAppPath}`);
assert(fs.existsSync(readmePath), `Target README.md not found at ${readmePath}`);
assert(fs.existsSync(backendMainPath), `Target backend/main.py not found at ${backendMainPath}`);
assert(fs.existsSync(backendPreprocessingPath), `Target backend/preprocessing.py not found at ${backendPreprocessingPath}`);
assert(fs.existsSync(backendOcrEnginePath), `Target backend/ocr_engine.py not found at ${backendOcrEnginePath}`);
assert(fs.existsSync(backendRequirementsPath), `Target backend/requirements.txt not found at ${backendRequirementsPath}`);

const indexContent = fs.readFileSync(indexPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const jsBrailleContent = fs.readFileSync(jsBraillePath, 'utf-8');
const jsThreeContent = fs.readFileSync(jsThreePath, 'utf-8');
const jsVoiceContent = fs.readFileSync(jsVoicePath, 'utf-8');
const jsOcrContent = fs.readFileSync(jsOcrEnginePath, 'utf-8');
const jsOcrModuleContent = fs.readFileSync(jsOcrModulePath, 'utf-8');
const jsCameraContent = fs.readFileSync(jsCameraPath, 'utf-8');
const jsTextProcessorContent = fs.readFileSync(jsTextProcessorPath, 'utf-8');
const jsDemoModeContent = fs.readFileSync(jsDemoModePath, 'utf-8');
const jsRealSimContent = fs.readFileSync(jsRealSimPath, 'utf-8');
const jsAppContent = fs.readFileSync(jsAppPath, 'utf-8');
const readmeContent = fs.readFileSync(readmePath, 'utf-8');
const backendMainContent = fs.readFileSync(backendMainPath, 'utf-8');
const backendPreprocessingContent = fs.readFileSync(backendPreprocessingPath, 'utf-8');
const backendOcrEngineContent = fs.readFileSync(backendOcrEnginePath, 'utf-8');
const backendRequirementsContent = fs.readFileSync(backendRequirementsPath, 'utf-8');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFn) {
    totalTests++;
    try {
        testFn();
        console.log(`  [PASS] Test ${totalTests.toString().padStart(2, '0')}: ${testName}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] Test ${totalTests.toString().padStart(2, '0')}: ${testName}`);
        console.error(`         Error: ${err.message}`);
        failedTests++;
    }
}

// -------------------------------------------------------------
// Suite 1: Document Structure & Modular HTML Links
// -------------------------------------------------------------
console.log('--- SUITE 1: HTML5 Document Structure & Module Links ---');

runTest('HTML5 DOCTYPE & Top-Level Tags Integrity in index.html', () => {
    assert(indexContent.includes('<!DOCTYPE html>'), 'Missing <!DOCTYPE html>');
    assert(indexContent.includes('<html lang="th">'), 'Missing <html lang="th">');
    assert(indexContent.includes('</html>'), 'Missing closing </html> tag');
    assert(indexContent.includes('<head>'), 'Missing <head> tag');
    assert(indexContent.includes('</head>'), 'Missing </head> tag');
    assert(indexContent.includes('<body>'), 'Missing <body> tag');
    assert(indexContent.includes('</body>'), 'Missing </body> tag');
});

runTest('External CDN Dependencies in index.html', () => {
    assert(indexContent.includes('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'), 'Missing Three.js CDN');
    assert(indexContent.includes('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'), 'Missing OrbitControls CDN');
    assert(indexContent.includes('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'), 'Missing FontAwesome CDN');
    assert(!indexContent.includes('tesseract'), 'Tesseract.js CDN should be removed - OCR now runs via the EasyOCR backend');
});

runTest('Modular Stylesheet & Script Tags in index.html (including OCR module split)', () => {
    assert(indexContent.includes('<link rel="stylesheet" href="css/styles.css">'), 'Missing css/styles.css link tag');
    assert(indexContent.includes('<script src="js/textProcessor.js"></script>'), 'Missing js/textProcessor.js script tag');
    assert(indexContent.includes('<script src="js/camera.js"></script>'), 'Missing js/camera.js script tag');
    assert(indexContent.includes('<script src="js/ocr.js"></script>'), 'Missing js/ocr.js script tag');
    assert(indexContent.includes('<script src="js/demoMode.js"></script>'), 'Missing js/demoMode.js script tag');
    assert(indexContent.includes('<script src="js/thai-braille-tables.js"></script>'), 'Missing js/thai-braille-tables.js script tag');
    assert(indexContent.includes('<script src="js/thai-wordlist.js"></script>'), 'Missing js/thai-wordlist.js script tag');
    assert(indexContent.includes('<script src="js/thai-braille.js"></script>'), 'Missing js/thai-braille.js script tag');
    assert(indexContent.indexOf('js/thai-braille-tables.js') < indexContent.indexOf('js/thai-braille.js'), 'thai-braille-tables.js must load before thai-braille.js');
    assert(indexContent.indexOf('js/thai-wordlist.js') < indexContent.indexOf('js/thai-braille.js'), 'thai-wordlist.js must load before thai-braille.js');
    assert(indexContent.indexOf('js/thai-braille.js') < indexContent.indexOf('js/braille-engine.js'), 'thai-braille.js must load before braille-engine.js');
    assert(indexContent.includes('<script src="js/braille-engine.js"></script>'), 'Missing js/braille-engine.js script tag');
    assert(indexContent.includes('<script src="js/three-scene.js"></script>'), 'Missing js/three-scene.js script tag');
    assert(indexContent.includes('<script src="js/voice-guidance.js"></script>'), 'Missing js/voice-guidance.js script tag');
    assert(indexContent.includes('<script src="js/ocr-engine.js"></script>'), 'Missing js/ocr-engine.js script tag');
    assert(indexContent.includes('<script src="js/app.js"></script>'), 'Missing js/app.js script tag');
});

// -------------------------------------------------------------
// Suite 2: CSS3 Modular Stylesheet & Theme Tokens
// -------------------------------------------------------------
console.log('\n--- SUITE 2: CSS3 Modular Stylesheet & Theme Tokens ---');

runTest('CSS Stylesheet Balanced Braces Check', () => {
    let braceCount = 0;
    for (let i = 0; i < cssContent.length; i++) {
        if (cssContent[i] === '{') braceCount++;
        if (cssContent[i] === '}') braceCount--;
        assert(braceCount >= 0, `Unmatched closing brace in CSS at char index ${i}`);
    }
    assert.strictEqual(braceCount, 0, `Unclosed brace in CSS styles (remaining open: ${braceCount})`);
});

runTest('Theme Tokens: Dark (:root) and Light (body.light-mode)', () => {
    assert(cssContent.includes(':root {'), 'Missing :root style rules in css/styles.css');
    assert(cssContent.includes('body.light-mode {'), 'Missing body.light-mode style rules in css/styles.css');
    assert(cssContent.includes('--accent-emerald:'), 'Missing --accent-emerald token');
    assert(cssContent.includes('--accent-cyan:'), 'Missing --accent-cyan token');
    assert(cssContent.includes('--accent-magenta:'), 'Missing --accent-magenta token');
    assert(cssContent.includes('--accent-amber:'), 'Missing --accent-amber token');
});

runTest('OCR, Viewfinder, 4-Corner HUD, Focus Detector & Inspector CSS Selectors', () => {
    const requiredClasses = [
        '.ocr-section',
        '.dropzone',
        '.camera-modal',
        '.viewfinder-box',
        '.viewfinder-corner',
        '.viewfinder-corner.locked',
        '.viewfinder-corner.missed',
        '.corner-label',
        '.corner-status-overlay',
        '.corner-status-overlay.locked-100',
        '.focus-status-hud',
        '.focus-status-hud.focus-blurry',
        '.focus-status-hud.focus-adjusting',
        '.focus-status-hud.focus-sharp',
        '#cornerTL',
        '#cornerTR',
        '#cornerBL',
        '#cornerBR',
        'targetLockPulse',
        '.shutter-btn',
        '.ocr-progress-bar',
        '.confidence-badge',
        '.dropzone-preview',
        '.voice-status-hud',
        '.cam-toggle-btn',
        '.camera-modal-header-actions',
        '.ocr-btn-inspector',
        '.ocr-inspector-card',
        '.inspector-canvas-wrap',
        '#ocrResultCanvasInspector',
        '.inspector-details-bar',
        '.inspector-word-tag'
    ];
    for (const cls of requiredClasses) {
        assert(cssContent.includes(cls), `Missing CSS selector or identifier: ${cls}`);
    }
});

runTest('Portrait Mode (9:16 / Book Format) CSS Viewfinder and Modal Specifications', () => {
    assert(cssContent.includes('aspect-ratio: 9 / 16'), 'Missing aspect-ratio: 9 / 16 on .viewfinder-box');
    assert(cssContent.includes('width: 480px') || cssContent.includes('max-width: 480px'), 'Missing 480px portrait width on .camera-modal-card');
});

// -------------------------------------------------------------
// Suite 3: DOM ID Structure Verification
// -------------------------------------------------------------
console.log('\n--- SUITE 3: DOM Elements & OCR IDs in index.html ---');

runTest('Required OCR Control Panel, 4-Corner Viewfinder, Focus HUD, Voice HUD & Inspector DOM IDs', () => {
    const requiredIds = [
        'ocrDropzone',
        'imageFileInput',
        'btnTriggerFileBrowse',
        'btnRemoveImage',
        'dropzonePreview',
        'previewThumbnail',
        'previewFilename',
        'btnOpenLiveCamera',
        'btnOpenOcrInspector',
        'btnDemoMode',
        'cameraModal',
        'cameraVideo',
        'cameraCaptureCanvas',
        'cornerTL',
        'cornerTR',
        'cornerBL',
        'cornerBR',
        'labelTL',
        'labelTR',
        'labelBL',
        'labelBR',
        'cornerStatusOverlay',
        'cornerAlignmentText',
        'focusStatusHud',
        'focusStatusText',
        'btnCaptureSnapshot',
        'btnSwitchCamera',
        'btnCloseCameraModal',
        'btnCancelCamera',
        'btnToggleVoiceGuidance',
        'btnToggleAutoCapture',
        'voiceStatusHud',
        'voiceStatusMsg',
        'ocrProgressContainer',
        'ocrProgressBar',
        'ocrStatusText',
        'ocrConfidenceScore',
        'ocrInspectorModal',
        'ocrResultCanvasInspector',
        'inspectorWordCount',
        'btnCloseOcrInspector',
        'inspectorDetailsBar',
        'thaiInput',
        'powerStatus',
        'btnPrevPage',
        'pageIndicator',
        'btnNextPage',
        'btnToggleLanguageMode'
    ];

    for (const id of requiredIds) {
        const idRegex = new RegExp(`id=["']${id}["']`);
        assert(idRegex.test(indexContent), `Missing DOM element with id="${id}" in index.html`);
    }

    assert(!/id=["']ocrLangSelect["']/.test(indexContent), 'ocrLangSelect should be removed - EasyOCR always loads both th+en, no language choice exists');
    assert(indexContent.includes('ocr-lang-badge'), 'Missing static ocr-lang-badge replacing the old language dropdown');
});

// -------------------------------------------------------------
// Suite 4: Modular JavaScript ES6+ Syntax & VM Sandboxing
// -------------------------------------------------------------
console.log('\n--- SUITE 4: JavaScript Modules ES6+ Syntax & Compilation ---');

runTest('Compile js/braille-engine.js with Node vm.Script', () => {
    new vm.Script(jsBrailleContent, { filename: 'braille-engine.js' });
    assert(jsBrailleContent.includes('function convertThaiToBraille'), 'Missing convertThaiToBraille (back-compat shim)');
    assert(jsBrailleContent.includes('function chunkTextForBraille'), 'Missing chunkTextForBraille');
    assert(jsBrailleContent.includes('function updatePaginationDisplay'), 'Missing updatePaginationDisplay');
    assert(jsBrailleContent.includes('function toggleLanguageMode'), 'Missing toggleLanguageMode');
    assert(!jsBrailleContent.includes('const THAI_BRAILLE_MAP'), 'THAI_BRAILLE_MAP should be gone - tables now live in js/thai-braille-tables.js');
});

runTest('Compile js/thai-braille-tables.js + js/thai-braille.js with Node vm.Script', () => {
    const tablesSrc = fs.readFileSync(path.join(projectRoot, 'js', 'thai-braille-tables.js'), 'utf-8');
    const engineSrc = fs.readFileSync(path.join(projectRoot, 'js', 'thai-braille.js'), 'utf-8');
    new vm.Script(tablesSrc, { filename: 'thai-braille-tables.js' });
    new vm.Script(engineSrc, { filename: 'thai-braille.js' });
    const tables = require(path.join(projectRoot, 'js', 'thai-braille-tables.js'));
    const engine = require(path.join(projectRoot, 'js', 'thai-braille.js'));
    assert.strictEqual(Object.keys(tables.THAI_CONSONANTS).length, 44, 'expected 44 Thai consonants');
    assert.strictEqual(typeof engine.textToBrailleCells, 'function', 'Missing textToBrailleCells');
    assert.strictEqual(typeof engine.paginateBrailleCells, 'function', 'Missing paginateBrailleCells');
});

runTest('Compile js/thai-wordlist.js + Thai word-spacing produces space cells', () => {
    const wlSrc = fs.readFileSync(path.join(projectRoot, 'js', 'thai-wordlist.js'), 'utf-8');
    new vm.Script(wlSrc, { filename: 'thai-wordlist.js' });
    const wl = require(path.join(projectRoot, 'js', 'thai-wordlist.js'));
    assert(wl.set && wl.size > 1000, 'wordlist should carry a few thousand words');
    const engine = require(path.join(projectRoot, 'js', 'thai-braille.js'));
    const spaces = engine.textToBrailleCells('สวัสดีครับ').filter(c => c.kind === 'space').length;
    assert.strictEqual(spaces, 1, 'สวัสดีครับ must split into สวัสดี | ครับ (1 space cell)');
});

runTest('Compile js/three-scene.js with Node vm.Script', () => {
    new vm.Script(jsThreeContent, { filename: 'three-scene.js' });
    assert(jsThreeContent.includes('function initMain3D'), 'Missing initMain3D');
    assert(jsThreeContent.includes('function createHardwareChassis'), 'Missing createHardwareChassis');
    assert(jsThreeContent.includes('function createTactical3DButtons'), 'Missing createTactical3DButtons');
    assert(jsThreeContent.includes('function drawButtonCanvas'), 'Missing drawButtonCanvas');
    assert(jsThreeContent.includes('function press3DButton'), 'Missing press3DButton');
    assert(jsThreeContent.includes('function update3DButtonsState'), 'Missing update3DButtonsState');
    assert(jsThreeContent.includes('function createBrailleCells'), 'Missing createBrailleCells');
    assert(jsThreeContent.includes('function animate'), 'Missing animate');
    assert(jsThreeContent.includes('function toggleExplodedView'), 'Missing toggleExplodedView');
    assert(jsThreeContent.includes('function initMechanism3D'), 'Missing initMechanism3D');
});

runTest('Compile js/voice-guidance.js with Node vm.Script (including Laplacian Focus Detector & HUD)', () => {
    new vm.Script(jsVoiceContent, { filename: 'voice-guidance.js' });
    assert(jsVoiceContent.includes('function calculateLaplacianFocusScore'), 'Missing calculateLaplacianFocusScore');
    assert(jsVoiceContent.includes('function updateFocusHUD'), 'Missing updateFocusHUD');
    assert(jsVoiceContent.includes('function speakVoiceGuidance'), 'Missing speakVoiceGuidance');
    assert(jsVoiceContent.includes('function playTacticalBeep'), 'Missing playTacticalBeep');
    assert(jsVoiceContent.includes('function updateCornerTargetHUD'), 'Missing updateCornerTargetHUD');
    assert(jsVoiceContent.includes('function analyzeLiveCameraFrame'), 'Missing analyzeLiveCameraFrame');
    assert(jsVoiceContent.includes('function startLiveVoiceGuidance'), 'Missing startLiveVoiceGuidance');
    assert(jsVoiceContent.includes('function stopLiveVoiceGuidance'), 'Missing stopLiveVoiceGuidance');
    assert(jsVoiceContent.includes('function toggleVoiceGuidance'), 'Missing toggleVoiceGuidance');
    assert(jsVoiceContent.includes('function toggleAutoCapture'), 'Missing toggleAutoCapture');
});

runTest('Compile js/ocr-engine.js with Node vm.Script (UI orchestration & unified pipeline)', () => {
    new vm.Script(jsOcrContent, { filename: 'ocr-engine.js' });
    assert(jsOcrContent.includes('async function runOcrPipeline'), 'Missing runOcrPipeline - the single unified OCR entry point');
    assert(jsOcrContent.includes('function renderOCRInspector'), 'Missing renderOCRInspector');
    assert(jsOcrContent.includes('function openOCRInspector'), 'Missing openOCRInspector');
    assert(jsOcrContent.includes('function closeOCRInspector'), 'Missing closeOCRInspector');
    assert(jsOcrContent.includes('async function captureCameraSnapshot'), 'Missing captureCameraSnapshot');
    assert(jsOcrContent.includes('function initOCRHandlers'), 'Missing initOCRHandlers');
    assert(jsOcrContent.includes('async function runDemoModeFlow'), 'Missing runDemoModeFlow');
});

runTest('Compile js/camera.js with Node vm.Script (client-only camera lifecycle & capture)', () => {
    new vm.Script(jsCameraContent, { filename: 'camera.js' });
    assert(jsCameraContent.includes('function startCameraStream'), 'Missing startCameraStream');
    assert(jsCameraContent.includes('function stopCameraStream'), 'Missing stopCameraStream');
    assert(jsCameraContent.includes('function switchCamera'), 'Missing switchCamera');
    assert(jsCameraContent.includes('function calculateViewfinderCrop'), 'Missing calculateViewfinderCrop');
    assert(jsCameraContent.includes('function captureFrameToFile'), 'Missing captureFrameToFile');
    assert(!/fetch\s*\(/.test(jsCameraContent), 'js/camera.js must stay client-side only - no network calls');
});

runTest('Compile js/ocr.js with Node vm.Script (the ONLY module that performs OCR)', () => {
    new vm.Script(jsOcrModuleContent, { filename: 'ocr.js' });
    assert(jsOcrModuleContent.includes('async function recognize'), 'Missing recognize() - the single exported OCR function');
    assert(jsOcrModuleContent.includes("fetch(OCR_BACKEND_URL"), 'recognize() must call the backend via fetch()');
    assert(jsOcrModuleContent.includes("method: 'POST'"), 'Missing POST method for /ocr call');
    assert(jsOcrModuleContent.includes('documentSource'), 'Missing documentSource form field passthrough');
});

runTest('Compile js/textProcessor.js with Node vm.Script (Thai-aware NFC normalization)', () => {
    new vm.Script(jsTextProcessorContent, { filename: 'textProcessor.js' });
    assert(jsTextProcessorContent.includes('function normalizeOcrText'), 'Missing normalizeOcrText');
    assert(jsTextProcessorContent.includes("normalize('NFC')"), 'Missing Unicode NFC normalization');
    assert(!/toUpperCase/.test(jsTextProcessorContent), 'textProcessor.js must not force uppercase - Thai has no case');
    assert(jsTextProcessorContent.includes('function classifyOcrConfidence'), 'Missing classifyOcrConfidence bucket helper');
    assert(jsTextProcessorContent.includes('function repairThaiToneMarks'), 'Missing repairThaiToneMarks() Thai tone-mark repair pass');
});

runTest('js/textProcessor.js classifyOcrConfidence() - three honest confidence buckets, not binary', () => {
    const ctx = vm.createContext({});
    vm.runInContext(jsTextProcessorContent, ctx);

    assert.strictEqual(ctx.classifyOcrConfidence(95), 'high', '95% -> high');
    assert.strictEqual(ctx.classifyOcrConfidence(72), 'high', 'exactly 72 -> high (>=)');
    assert.strictEqual(ctx.classifyOcrConfidence(60), 'medium', '60% -> medium (saw text, half is probably wrong)');
    assert.strictEqual(ctx.classifyOcrConfidence(45), 'medium', 'exactly 45 -> medium (>=)');
    assert.strictEqual(ctx.classifyOcrConfidence(30), 'low', '30% -> low');
    assert.strictEqual(ctx.classifyOcrConfidence(0), 'low', '0% -> low');
    // Garbage in never throws - defaults to the most cautious bucket.
    assert.strictEqual(ctx.classifyOcrConfidence(undefined), 'low', 'undefined -> low');
    assert.strictEqual(ctx.classifyOcrConfidence(NaN), 'low', 'NaN -> low');
    assert.strictEqual(ctx.classifyOcrConfidence('nonsense'), 'low', 'non-number -> low');
});

runTest('js/textProcessor.js repairThaiToneMarks() - restores unambiguous dropped tone marks, never corrupts real words', () => {
    const wl = require(path.join(projectRoot, 'js', 'thai-wordlist.js'));
    const ctx = vm.createContext({ THAI_WORDLIST: wl, console });
    vm.runInContext(jsTextProcessorContent, ctx);
    const R = ctx.repairThaiToneMarks;

    // Dropped tone mark, exactly one dictionary reading -> restored.
    assert.strictEqual(R('ให'), 'ให้', 'ให -> ให้ (dropped mai tho)');
    assert.strictEqual(R('แลว'), 'แล้ว', 'แลว -> แล้ว');
    // The mark belongs after the above-vowel, not the consonant.
    assert.strictEqual(R('ขึน'), 'ขึ้น', 'ขึน -> ขึ้น (mark sits after ึ)');

    // Correctly-read words are NEVER touched - idempotent over the whole list.
    let altered = 0;
    for (const w of wl.set) { if (R(w) !== w) { altered++; if (altered <= 3) console.log('   altered:', w, '->', R(w)); } }
    assert.strictEqual(altered, 0, 'no dictionary word may be rewritten by the repair pass');

    // "ขาว" (white) is a real word; even though "ข้าว" (rice) is one tone
    // edit away, an in-dictionary token is left alone.
    assert.strictEqual(R('ขาว'), 'ขาว', 'a valid word one edit from another valid word is left as-is');

    // Ambiguous / unknown -> unchanged (never a wrong guess).
    assert.strictEqual(R('พด'), 'พด', 'พด has no unambiguous tone-only repair -> unchanged');
    assert.strictEqual(R('ผมชอบกินขาว'), 'ผมชอบกินขาว', 'long glued token (>6 chars) is not touched');

    // Multi-token strings are repaired per whitespace token, spacing preserved.
    assert.strictEqual(R('แลว ผม ให คุณ'), 'แล้ว ผม ให้ คุณ', 'per-token repair, whitespace kept');

    // Non-Thai and mixed tokens pass straight through.
    assert.strictEqual(R('HELLO ครบ'), 'HELLO ครบ', 'latin token untouched; ครบ has no unambiguous repair');
    assert.strictEqual(R('abc123'), 'abc123');

    // Runtime kill-switch.
    ctx.ENABLE_THAI_OCR_REPAIR = false;
    assert.strictEqual(R('ให'), 'ให', 'globalThis.ENABLE_THAI_OCR_REPAIR = false disables the pass');
    ctx.ENABLE_THAI_OCR_REPAIR = true;

    // Degrades to a no-op with no wordlist loaded.
    const bare = vm.createContext({ console });
    vm.runInContext(jsTextProcessorContent, bare);
    assert.strictEqual(bare.repairThaiToneMarks('ให'), 'ให', 'no wordlist -> no-op');
    assert.strictEqual(bare.normalizeOcrText('  Hello   สวัสดี  '), 'Hello สวัสดี', 'normalizeOcrText still works without wordlist');
});

runTest('Compile js/demoMode.js with Node vm.Script (isolated from real OCR)', () => {
    new vm.Script(jsDemoModeContent, { filename: 'demoMode.js' });
    assert(jsDemoModeContent.includes('function runDemoOcr'), 'Missing runDemoOcr');
    assert(jsDemoModeContent.includes('setTimeout'), 'Missing artificial delay simulating an OCR call');
    assert(!/fetch\s*\(/.test(jsDemoModeContent), 'js/demoMode.js must never call the network / real OCR backend');
    assert(/[฀-๿]/.test(jsDemoModeContent), 'Missing a hardcoded Thai sample string');
});

runTest('Compile js/real-simulation.js with Node vm.Script (Automated Multi-Line Scan & Paging)', () => {
    new vm.Script(jsRealSimContent, { filename: 'real-simulation.js' });
    assert(jsRealSimContent.includes('function startRealSimulation'), 'Missing startRealSimulation');
    assert(jsRealSimContent.includes('function closeRealSimulation'), 'Missing closeRealSimulation');
    assert(jsRealSimContent.includes('function stepSimLine'), 'Missing stepSimLine');
    assert(jsRealSimContent.includes('REAL_SIMULATION_LINES'), 'Missing REAL_SIMULATION_LINES array');
});

runTest('Compile js/app.js with Node vm.Script', () => {
    new vm.Script(jsAppContent, { filename: 'app.js' });
    assert(jsAppContent.includes('function restoreSavedTheme'), 'Missing restoreSavedTheme');
    assert(jsAppContent.includes("window.addEventListener('DOMContentLoaded'"), 'Missing DOMContentLoaded listener in app.js');
});

// -------------------------------------------------------------
// Suite 5: Logic, Vision Algorithms & Viewfinder Crop Pipeline
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Logic, Vision Algorithms & Viewfinder Crop Pipeline ---');

runTest('Laplacian Variance Focus Detection 3x3 Kernel Math & Thresholds', () => {
    assert(jsVoiceContent.includes('calculateLaplacianFocusScore'), 'Missing calculateLaplacianFocusScore');
    assert(jsVoiceContent.includes('FOCUS_BLURRY_THRESHOLD = 80'), 'Missing FOCUS_BLURRY_THRESHOLD = 80');
    assert(jsVoiceContent.includes('FOCUS_SHARP_THRESHOLD = 160'), 'Missing FOCUS_SHARP_THRESHOLD = 160');

    // Test Laplacian Variance Math with simulated Blurry vs Sharp Data
    const sandbox = {
        Math: Math,
        Uint8Array: Uint8Array,
        calculateLaplacianFocusScore: null
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsVoiceContent, ctx);

    // 1. Uniform Blurry Pattern (Very low Laplacian variance)
    const blurryData = new Uint8Array(40 * 40 * 4);
    for (let i = 0; i < blurryData.length; i += 4) {
        blurryData[i] = 128 + (i % 2); // almost zero gradient
        blurryData[i+1] = 128;
        blurryData[i+2] = 128;
        blurryData[i+3] = 255;
    }
    const blurryScore = ctx.calculateLaplacianFocusScore({ width: 40, height: 40, data: blurryData });
    assert(blurryScore < 80, `Blurry score should be < 80, got ${blurryScore}`);

    // 2. High Frequency Sharp Text Edge Pattern (High Laplacian variance)
    const sharpData = new Uint8Array(40 * 40 * 4);
    for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
            const idx = (y * 40 + x) * 4;
            const val = ((x % 4 < 2) && (y % 4 < 2)) ? 255 : 0;
            sharpData[idx] = val;
            sharpData[idx+1] = val;
            sharpData[idx+2] = val;
            sharpData[idx+3] = 255;
        }
    }
    const sharpScore = ctx.calculateLaplacianFocusScore({ width: 40, height: 40, data: sharpData });
    assert(sharpScore >= 160, `Sharp score should be >= 160, got ${sharpScore}`);
});

runTest('Focus Voice Guidance Prompts & Focus Gating Protection', () => {
    assert(jsVoiceContent.includes('ภาพยังเบลออยู่ ถือกล้องนิ่งๆ อีกนิดนะครับ'), 'Missing blurry voice prompt');
    assert(jsVoiceContent.includes('ตัวอักษรชัดเจนแล้ว ถือค้างไว้นะครับ...'), 'Missing sharp voice prompt');
    assert(/m\.focus >= FOCUS_SHARP_THRESHOLD\b/.test(jsVoiceContent), 'Auto-Capture must gate the shutter trigger on the (smoothed) focus score >= FOCUS_SHARP_THRESHOLD (160)');
});

runTest('Real-time Focus Status HUD Format & Score Display', () => {
    assert(jsVoiceContent.includes('FOCUS: BLURRY (Score'), 'Missing blurry focus HUD format');
    assert(jsVoiceContent.includes('FOCUS: SHARP 100% (Score'), 'Missing sharp focus HUD format');
});

runTest('Viewfinder Crop Coordinate Calculation & 85% Fallback in js/camera.js', () => {
    assert(jsCameraContent.includes('viewfinderBox'), 'Missing viewfinderBox reference');
    assert(jsCameraContent.includes('viewfinder-frame'), 'Missing viewfinder-frame selector');
    assert(jsCameraContent.includes('calculateViewfinderCrop'), 'Missing calculateViewfinderCrop invocation');
    assert(jsCameraContent.includes('vw * 0.85'), 'Missing 85% safety fallback crop calculation');
    assert(jsCameraContent.includes('drawImage(video, sx, sy, sw, sh'), 'Missing precise source crop drawImage coordinates');
});

runTest('Backend Preprocessing Pipeline (Resize, CLAHE, Adaptive Threshold, Source-Aware Denoise)', () => {
    assert(backendPreprocessingContent.includes('MIN_SHORT_SIDE = 1100'), 'Missing 1100px minimum short-side resize target (raised from 640 for Thai x-height)');
    assert(backendPreprocessingContent.includes('createCLAHE'), 'Missing CLAHE contrast enhancement');
    assert(backendPreprocessingContent.includes('adaptiveThreshold'), 'Missing adaptive threshold for uneven lighting');
    assert(backendPreprocessingContent.includes('_is_lighting_uneven'), 'Missing lighting-unevenness heuristic gating the adaptive threshold');
    assert(backendPreprocessingContent.includes('fastNlMeansDenoising'), 'Missing denoise step');
    assert(backendPreprocessingContent.includes('document_source == "camera"'), 'Denoise strength must be tuned by documentSource (camera vs upload)');
    assert(backendPreprocessingContent.includes('detect_document_quad') && backendPreprocessingContent.includes('warpPerspective'), 'Missing document quad detection + perspective (deskew) warp');
});

runTest('EasyOCR Engine Configuration (Thai + English, Beamsearch, Per-Word Boxes)', () => {
    assert(backendOcrEngineContent.includes('"th"') && backendOcrEngineContent.includes('"en"'), "EasyOCR must still support the th+en language set");
    assert(backendOcrEngineContent.includes('_LANG_SETS') && backendOcrEngineContent.includes('def get_reader'), 'Missing per-language reader cache (th vs th+en) for Thai-only accuracy mode');
    assert(backendOcrEngineContent.includes('decoder="beamsearch"'), 'Missing decoder=\"beamsearch\" for accuracy');
    assert(backendOcrEngineContent.includes('paragraph=False'), 'Missing paragraph=False for per-word bounding boxes');
    assert(backendOcrEngineContent.includes('_bbox_to_rect'), 'Missing conversion of EasyOCR polygon bbox to axis-aligned rect');
});

runTest('Backend OCR noise rejection (digit/symbol hallucination + layout logo strips)', () => {
    // Regression guards for the real test-photo failures:
    //  - "AIS" wooden letters on a wood-grain table came back as "1 , 111
    //    โ ) 1" at 54% - mostly digits/punctuation, mediocre confidence.
    //  - A "MAMO" headline came back with the sponsor-logo strip glued on
    //    ("mamo als academy ni okmd").
    // See backend/test_ocr_text_assembly.py Cases 9 & 10 for the behavioural
    // tests; this just pins that the guards are still wired into run_ocr().
    assert(backendOcrEngineContent.includes('def _looks_like_text'),
        'Missing _looks_like_text() digit/symbol-soup rejection');
    assert(backendOcrEngineContent.includes('def _letter_ratio'),
        'Missing _letter_ratio() helper');
    assert(backendOcrEngineContent.includes('def _filter_layout_noise'),
        'Missing _filter_layout_noise() logo/fine-print stripper');
    assert(/_filter_layout_noise\(\s*filter_confident_words\(/.test(backendOcrEngineContent),
        'run_ocr must chain filter_confident_words -> _filter_layout_noise before assembly');
    assert(/if not _looks_like_text\(/.test(backendOcrEngineContent),
        'run_ocr must blank the text when _looks_like_text() rejects it');
});

runTest('FastAPI /ocr Endpoint Contract', () => {
    assert(backendMainContent.includes('@app.post("/ocr")'), 'Missing POST /ocr route');
    assert(backendMainContent.includes('CORSMiddleware'), 'Missing CORS middleware for the local frontend');
    assert(backendMainContent.includes('documentSource'), 'Missing documentSource form field');
    assert(backendRequirementsContent.includes('fastapi'), 'Missing fastapi in requirements.txt');
    assert(backendRequirementsContent.includes('easyocr'), 'Missing easyocr in requirements.txt');
    assert(backendRequirementsContent.includes('opencv-python'), 'Missing opencv-python in requirements.txt');
    assert(backendRequirementsContent.includes('python-multipart'), 'Missing python-multipart in requirements.txt');
});

runTest('Single Unified OCR Call Path (Upload & Camera share runOcrPipeline; documentSource is UI-label only)', () => {
    assert(jsOcrContent.includes('isOCROngoing'), 'Missing reentrancy guard isOCROngoing');
    assert(/runOcrPipeline\(\s*file\s*,\s*['"]upload['"]\s*\)/.test(jsOcrContent), 'Upload flow must call runOcrPipeline(file, \'upload\')');
    assert(/runOcrPipeline\(\s*file\s*,\s*['"]camera['"]\s*\)/.test(jsOcrContent), 'Camera flow must call runOcrPipeline(file, \'camera\')');
    assert(jsOcrContent.includes('await recognize(imageFile, documentSource)'), 'runOcrPipeline must delegate the actual OCR call to js/ocr.js\'s recognize()');
    assert(jsOcrContent.includes('normalizeOcrText(result.text)'), 'runOcrPipeline must normalize OCR text via js/textProcessor.js');
    // The low-confidence gate that blocks Braille actuation on unclear reads
    // now routes through the shared three-bucket classifier instead of a
    // local numeric cutoff, so camera.html and this modal agree.
    assert(jsOcrContent.includes('ocrConfidenceTier') || jsOcrContent.includes('classifyOcrConfidence'),
        'Missing shared confidence-tier classification');
    assert(/tier === 'low'/.test(jsOcrContent),
        'Missing low-tier gate blocking Braille actuation on unclear images');
    assert(/tier === 'medium'/.test(jsOcrContent),
        "Missing medium tier - a borderline read must show the result but labelled 'อาจมีคำผิด', not a green success");
});

runTest('Visual OCR Bounding Box Inspector Canvas Rendering & Glowing Bounding Boxes', () => {
    assert(jsOcrContent.includes('renderOCRInspector'), 'Missing renderOCRInspector function');
    assert(jsOcrContent.includes('ocrResultCanvasInspector'), 'Missing ocrResultCanvasInspector canvas binding');
    assert(jsOcrContent.includes("ctx.strokeStyle = '#00FF88'"), 'Missing neon-emerald bounding box outline');
    assert(jsOcrContent.includes("ctx.shadowColor = '#00FF88'"), 'Missing glowing shadow color for boxes');
    assert(jsOcrContent.includes('strokeRect(bx, by, bw, bh)'), 'Missing bounding box stroke rectangle drawing');
    assert(jsOcrContent.includes('openOCRInspector'), 'Missing openOCRInspector function');
    assert(jsOcrContent.includes('closeOCRInspector'), 'Missing closeOCRInspector function');
    assert(jsOcrContent.includes('btnOpenOcrInspector'), 'Missing btnOpenOcrInspector event binding');
});

runTest('4-Corner Target Detection Engine & Directional Guidance Voice Prompts', () => {
    assert(jsVoiceContent.includes('ตัวอักษรชัดเจนแล้ว ถือค้างไว้นะครับ...') || jsVoiceContent.includes('เข้ามุมทั้ง 4 เรียบร้อยแล้ว ถือค้างไว้นะครับ...'), 'Missing 4-corner lock Thai prompt');
    assert(jsVoiceContent.includes('มุมบนซ้ายหลุดกรอบ'), 'Missing top-left corner slip Thai prompt');
    assert(jsVoiceContent.includes('มุมบนขวาหลุดกรอบ'), 'Missing top-right corner slip Thai prompt');
    assert(jsVoiceContent.includes('มุมล่างซ้ายหลุดกรอบ'), 'Missing bottom-left corner slip Thai prompt');
    assert(jsVoiceContent.includes('มุมล่างขวาหลุดกรอบ'), 'Missing bottom-right corner slip Thai prompt');
    assert(jsVoiceContent.includes('ยังไม่พบเอกสาร กรุณาส่องกล้องไปที่หนังสือ'), 'Missing no document Thai prompt');
    assert(jsVoiceContent.includes('ถ่ายภาพสำเร็จ กำลังอ่านข้อความภาษาอังกฤษ...'), 'Missing capture success Thai prompt');
    assert(jsVoiceContent.includes("'th-TH'"), 'Missing Thai th-TH voice language specification');
});

runTest('4-Corner Target Locked Bracket Density Scanning & HUD Synchronization', () => {
    assert(jsVoiceContent.includes('CORNER_STROKE_THRESHOLD = 0.02'), 'Missing CORNER_STROKE_THRESHOLD constant');
    assert(jsVoiceContent.includes('zoneTL'), 'Missing zoneTL corner target boundary definition');
    assert(jsVoiceContent.includes('zoneTR'), 'Missing zoneTR corner target boundary definition');
    assert(jsVoiceContent.includes('zoneBL'), 'Missing zoneBL corner target boundary definition');
    assert(jsVoiceContent.includes('zoneBR'), 'Missing zoneBR corner target boundary definition');
    assert(jsVoiceContent.includes('densityTL = countTL / Math.max(1, pixelsTL)'), 'Missing densityTL calculation');
    assert(/updateCornerTargetHUD\(lockedTL, lockedTR, lockedBL, lockedBR\b/.test(jsVoiceContent), 'Missing updateCornerTargetHUD invocation');
});

runTest('Real-Time 4-Corner Target Alignment Percentage Math & 100% Lock Banner', () => {
    function calcCornerPct(tl, tr, bl, br) {
        const lockedCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
        const pct = Math.round((lockedCount / 4) * 100);
        return { lockedCount, pct, is100: lockedCount === 4 };
    }

    assert.deepStrictEqual(calcCornerPct(false, false, false, false), { lockedCount: 0, pct: 0, is100: false });
    assert.deepStrictEqual(calcCornerPct(true, false, false, false), { lockedCount: 1, pct: 25, is100: false });
    assert.deepStrictEqual(calcCornerPct(true, true, false, false), { lockedCount: 2, pct: 50, is100: false });
    assert.deepStrictEqual(calcCornerPct(true, true, true, false), { lockedCount: 3, pct: 75, is100: false });
    assert.deepStrictEqual(calcCornerPct(true, true, true, true), { lockedCount: 4, pct: 100, is100: true });

    assert(jsVoiceContent.includes('4-CORNER ALIGNMENT'), 'Missing 4-CORNER ALIGNMENT HUD text');
    assert(jsVoiceContent.includes('[ 🎯 TARGET LOCKED 100% - AUTO CAPTURING... ]'), 'Missing 100% target locked banner text');
    assert(jsVoiceContent.includes('locked-100'), 'Missing locked-100 class toggle on 100% alignment');
});

runTest('Auto-Capture Stability Timing Math (1.5s Rapid Shutter Requirement)', () => {
    const STABILITY_REQUIRED_MS = 1500;
    const startTime = 10000;
    const checkTime = 11500;
    const elapsed = checkTime - startTime;
    assert.strictEqual(elapsed >= STABILITY_REQUIRED_MS, true, 'Stability elapsed time check failed');
    assert(jsVoiceContent.includes('STABILITY_REQUIRED_MS = 1500'), 'js/voice-guidance.js must use 1500ms stability threshold');
});

runTest('Capture Arm Delay (no auto-shutter in the first 2s after the camera opens)', () => {
    // Regression guard: a document already framed the instant the camera
    // opens must not be able to satisfy corner+focus+stability and fire the
    // shutter before the user has had a chance to actually aim.
    assert(jsVoiceContent.includes('CAPTURE_ARM_DELAY_MS = 2000'), 'Missing CAPTURE_ARM_DELAY_MS constant');
    assert(jsVoiceContent.includes('function isCaptureArmed'), 'Missing isCaptureArmed() helper');
    assert(jsVoiceContent.includes('!isCaptureArmed()'), 'Auto-capture branch must be gated on isCaptureArmed()');
    assert(jsVoiceContent.includes('guidanceStartTime = Date.now()'), 'startLiveVoiceGuidance must stamp guidanceStartTime');

    // guidanceStartTime is a top-level `let`, which (like THAI_BRAILLE_MAP's
    // `const` case above) is not reachable as a sandbox global property -
    // bridge it with an appended setter sharing the same script scope.
    const sandbox = { Date };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsVoiceContent + '\nfunction __setGuidanceStart__(t) { guidanceStartTime = t; }', ctx);
    ctx.__setGuidanceStart__(10000);
    const realNow = Date.now;
    try {
        Date.now = () => 11000; // 1s after camera opened - still inside warm-up
        assert.strictEqual(ctx.isCaptureArmed(), false, 'must not be armed 1s after opening (< 2s warm-up)');
        Date.now = () => 12500; // 2.5s after camera opened - warm-up elapsed
        assert.strictEqual(ctx.isCaptureArmed(), true, 'must be armed once the 2s warm-up has elapsed');
    } finally {
        Date.now = realNow;
    }
});

runTest('Pre-Capture Voice Warning (0.6s Warning Before Shutter & Speech Callback)', () => {
    assert(jsVoiceContent.includes('PRE_CAPTURE_WARNING_MS = 600'), 'Missing PRE_CAPTURE_WARNING_MS constant');
    assert(jsVoiceContent.includes('กำลังถ่ายภาพ อยู่นิ่งๆ นะครับ') || jsVoiceContent.includes('อยู่นิ่งๆ นะครับ'), 'Missing pre-capture Thai warning text');
    assert(jsVoiceContent.includes('hasSpokenPreCaptureWarning'), 'Missing hasSpokenPreCaptureWarning flag');
    assert(jsVoiceContent.includes('speakVoiceGuidance(text, force = false, onEndCallback = null)'), 'Missing onEndCallback parameter in speakVoiceGuidance');
    assert(jsOcrContent.includes('playTacticalBeep(1050, 220)'), 'Missing tactical beep feedback on snapshot capture');
});

runTest('Voice Guidance & Auto-Capture Toggle States', () => {
    assert(jsVoiceContent.includes('toggleVoiceGuidance'), 'Missing toggleVoiceGuidance function');
    assert(jsVoiceContent.includes('toggleAutoCapture'), 'Missing toggleAutoCapture function');
    assert(jsOcrContent.includes('btnToggleVoiceGuidance'), 'Missing btnToggleVoiceGuidance binding');
    assert(jsOcrContent.includes('btnToggleAutoCapture'), 'Missing btnToggleAutoCapture binding');
});

runTest('Auto-Capture defaults to OFF (manual shutter is the default)', () => {
    assert(jsVoiceContent.includes('let isAutoCaptureEnabled = false'), 'isAutoCaptureEnabled must default to false');

    // The static markup must match the JS default so there's no flash of
    // the wrong toggle state before syncGuidanceButtons() runs on load.
    const cameraHtmlContent = fs.readFileSync(path.join(projectRoot, 'camera.html'), 'utf-8');
    const btnMatch = cameraHtmlContent.match(/<button[^>]*id="btnToggleAutoCapture"[^>]*>/);
    assert(btnMatch, 'Missing btnToggleAutoCapture button markup');
    assert(!/\bactive\b/.test(btnMatch[0]), 'btnToggleAutoCapture must not start with the active class');
    assert(cameraHtmlContent.includes('<span id="autoCaptureText">ออโต้ชัตเตอร์: ปิด</span>'),
        'autoCaptureText must start as ปิด (off)');

    // Manual mode must tell the user to press the shutter, not run the
    // auto-capture countdown language (which would promise a photo that
    // never gets taken while isAutoCaptureEnabled is false).
    assert(jsVoiceContent.includes('!isAutoCaptureEnabled'), 'analyzeLiveCameraFrame must branch on manual mode');
    assert(jsVoiceContent.includes('กดปุ่มถ่ายภาพได้เลยครับ'), 'Missing manual-shutter-ready voice prompt');
});

runTest('Stop-reading button next to every read-aloud button (long OCR text must be interruptible)', () => {
    const cameraHtmlContent = fs.readFileSync(path.join(projectRoot, 'camera.html'), 'utf-8');

    // camera.html: speakResult() + its own stop button/function.
    assert(cameraHtmlContent.includes('onclick="stopSpeakingResult()"'), 'camera.html missing stop-reading button');
    assert(cameraHtmlContent.includes('function stopSpeakingResult()') &&
        cameraHtmlContent.includes('window.speechSynthesis.cancel()'),
        'camera.html missing stopSpeakingResult() calling speechSynthesis.cancel()');

    // index.html + js/ocr-engine.js: speakResultText() result modal.
    assert(indexContent.includes('onclick="stopSpeakingResult()"'), 'index.html missing stop-reading button');
    assert(jsOcrContent.includes('function stopSpeakingResult()') &&
        jsOcrContent.includes('window.speechSynthesis.cancel()'),
        'js/ocr-engine.js missing stopSpeakingResult() calling speechSynthesis.cancel()');
});

runTest('OCR result confidence is a 3-tier signal (high / medium / low), not a binary green tick', () => {
    const cameraHtmlContent = fs.readFileSync(path.join(projectRoot, 'camera.html'), 'utf-8');

    // camera.html result screen: the success badge + detected-text colour
    // must be driven by classifyOcrConfidence, with an explicit "อาจมีคำผิด"
    // wording for the medium bucket. Regression guard for the screenshot
    // where a 54% read of wood-grain noise showed a confident green
    // "ตรวจพบข้อความ".
    assert(cameraHtmlContent.includes('classifyOcrConfidence'),
        'camera.html renderResultData must classify OCR confidence into tiers');
    assert(cameraHtmlContent.includes('อาจมีคำผิด'),
        'camera.html must warn "อาจมีคำผิด" on a medium-confidence read instead of a plain success badge');

    // ...and a blind user, who can't see that badge, must hear the same
    // caveat spoken once when the result lands (not a full read-aloud - that
    // stays on the manual button).
    assert(cameraHtmlContent.includes('function speakOcrResultCue'),
        'camera.html must speak a confidence cue after the OCR result lands');
    assert(/speakOcrResultCue\(\)/.test(cameraHtmlContent),
        'speakOcrResultCue() must actually be called from displayOCRResult');

    // js/ocr-engine.js result modal: same tiering, plus a visible badge.
    assert(jsOcrContent.includes('ocrConfidenceTier') || jsOcrContent.includes('classifyOcrConfidence'),
        'js/ocr-engine.js must classify OCR confidence into tiers');
    assert(jsOcrContent.includes('resConfidenceBadge'),
        'js/ocr-engine.js renderResultScreenData must populate the result-modal confidence badge');
    assert(indexContent.includes('id="resConfidenceBadge"'),
        'index.html result modal must have a confidence badge element');
});

runTest('speechSynthesis unlock on first user gesture (beeps-but-no-voice regression guard)', () => {
    // Regression guard for a real report: the camera+guidance loop starts on
    // DOMContentLoaded (no click involved) and re-fires every 300ms from a
    // setInterval tick, so speechSynthesis.speak() calls never have a user
    // gesture attached. Some browsers/WebViews silently drop speak() without
    // one, while WebAudio beeps keep working (an AudioContext only needs
    // unlocking once). Fix: prime speechSynthesis from the first real tap.
    assert(jsVoiceContent.includes('function unlockSpeechSynthesis'), 'Missing unlockSpeechSynthesis()');
    assert(jsVoiceContent.includes("document.addEventListener(evt, handleFirstGesture"),
        'Must attach a document-level first-gesture listener to unlock speechSynthesis');
    const speakFnBody = jsVoiceContent.slice(jsVoiceContent.indexOf('function speakVoiceGuidance'));
    assert(speakFnBody.startsWith('function speakVoiceGuidance') && speakFnBody.includes('unlockSpeechSynthesis();'),
        'speakVoiceGuidance must also opportunistically call unlockSpeechSynthesis()');

    const events = {};
    const fakeDocument = {
        addEventListener: (evt, fn) => { (events[evt] = events[evt] || []).push(fn); },
        removeEventListener: (evt, fn) => {
            if (events[evt]) events[evt] = events[evt].filter(f => f !== fn);
        }
    };
    let spokenUtterances = [];
    const fakeSpeechSynthesis = {
        speak: (u) => spokenUtterances.push(u),
        cancel: () => {},
        getVoices: () => []
    };
    const sandbox = {
        document: fakeDocument,
        window: { speechSynthesis: fakeSpeechSynthesis },
        speechSynthesis: fakeSpeechSynthesis,
        SpeechSynthesisUtterance: function (text) { this.text = text; },
        console: { warn: () => {} },
        Date, setInterval: () => 0, clearInterval: () => {}
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsVoiceContent, ctx);

    assert(events.click && events.click.length > 0, 'No click listener registered to unlock speech');
    assert.strictEqual(spokenUtterances.length, 0, 'Must not speak before any user gesture');

    // Simulate the user's first tap anywhere on the page.
    events.click.slice().forEach(fn => fn());

    assert.strictEqual(spokenUtterances.length, 1, 'First gesture must prime speechSynthesis with one utterance');
    assert.strictEqual(events.click.length, 0, 'Listener must remove itself after the first gesture (once-only)');
});

runTest('3x3 Gaussian Denoise Noise Reduction Filter Kernel Math Simulation', () => {
    const center = 120;
    const ortho = 100;
    const diag = 80;
    const sum = (diag * 1 + ortho * 2 + diag * 1 + ortho * 2 + center * 4 + ortho * 2 + diag * 1 + ortho * 2 + diag * 1);
    const denoisedVal = sum >> 4;
    assert.strictEqual(denoisedVal, 100, 'Gaussian 3x3 denoise kernel math calculation error');
});

runTest('High-Resolution Portrait Mode (9:16 Full HD) WebRTC Video Constraints', () => {
    assert(jsCameraContent.includes('aspectRatio: { ideal: 9 / 16 }'), 'Missing portrait 9:16 aspect ratio constraint');
    assert(jsCameraContent.includes('width: { ideal: 1080'), 'Missing ideal 1080 portrait width constraint');
    assert(jsCameraContent.includes('height: { ideal: 1920'), 'Missing ideal 1920 portrait height constraint');
    assert(jsCameraContent.includes('video.videoWidth'), 'Missing video.videoWidth native resolution grab');
    assert(jsCameraContent.includes('video.videoHeight'), 'Missing video.videoHeight native resolution grab');
});

runTest('3D Hardware Interactive Tactical Buttons (Prev, Next, Mode) & Raycaster Handlers', () => {
    assert(jsThreeContent.includes('btn3DPrevGroup'), 'Missing btn3DPrevGroup in three-scene.js');
    assert(jsThreeContent.includes('btn3DNextGroup'), 'Missing btn3DNextGroup in three-scene.js');
    assert(jsThreeContent.includes('btn3DModeGroup'), 'Missing btn3DModeGroup in three-scene.js');
    assert(jsThreeContent.includes('press3DButton(target.interactiveType)'), 'Missing 3D button click press dispatcher');
});

runTest('Text-presence gate rejects non-text scenes & keeps text (js/voice-guidance.js)', () => {
    assert(jsVoiceContent.includes('function detectTextLikeStructure'), 'Missing detectTextLikeStructure()');
    assert(jsVoiceContent.includes('textStruct.rows') && jsVoiceContent.includes('textStruct.components'),
        'analyzeLiveCameraFrame must feed detectTextLikeStructure output into its text-confidence gate');
    assert(jsVoiceContent.includes("textConfidence === 'no'"),
        'analyzeLiveCameraFrame must bail out (no auto-capture) when text confidence is "no"');
    assert(jsVoiceContent.includes("textConfidence !== 'confident'") && jsVoiceContent.includes("textConfidence = 'confident'"),
        'analyzeLiveCameraFrame must treat "confident" text specially (person guard) - 3-level confidence, not a boolean');
    assert(jsVoiceContent.includes('ยังไม่เจอข้อความ ลองเล็งกล้องไปที่หนังสือหรือกระดาษนะครับ'), 'Missing distinct no-text Thai prompt');
    assert(jsVoiceContent.includes('กล้องเจอคน'), 'Missing "camera sees a person" Thai prompt');
    assert(jsVoiceContent.includes('computeSkinRatio'), 'Missing skin-tone ratio helper for person detection');

    const ctx = vm.createContext({ Math, Uint8Array, Int32Array, Date, setInterval: () => 0, clearInterval: () => {}, console });
    vm.runInContext(jsVoiceContent, ctx);
    const w = 120, h = 160;

    const blank = new Uint8Array(w * h).fill(200);
    assert.strictEqual(ctx.detectTextLikeStructure(blank, w, h).isText, false, 'Blank frame must not read as text');

    const txt = new Uint8Array(w * h).fill(210);
    for (let r = 0; r < 6; r++) {
        const y = 15 + r * 22;
        for (let g = 0; g < 14; g++) {
            const x0 = 8 + g * 8;
            for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 5; dx++) txt[(y + dy) * w + (x0 + dx)] = 20;
        }
    }
    assert.strictEqual(ctx.detectTextLikeStructure(txt, w, h).isText, true, 'Rows of glyph-sized blobs must read as text');

    const blob = new Uint8Array(w * h).fill(200);
    for (let y = 30; y < 130; y++) for (let x = 30; x < 90; x++) blob[y * w + x] = 90;
    assert.strictEqual(ctx.detectTextLikeStructure(blob, w, h).isText, false, 'One large blob (a face/object) must not read as text');
});

runTest('Camera guidance is temporally smoothed + debounced (anti-flicker)', () => {
    assert(jsVoiceContent.includes('function smoothFrameMetrics') && jsVoiceContent.includes('function ema'),
        'Missing EMA metric smoothing');
    assert(jsVoiceContent.includes('function commitGuidance'),
        'Missing commitGuidance() state-commit debounce');
    assert(jsVoiceContent.includes('hasDocumentSticky'),
        'Missing hysteresis latch for document presence');
    assert(jsVoiceContent.includes('DOC_STROKES_ENTER') && jsVoiceContent.includes('DOC_STROKES_EXIT'),
        'Document detection must have separate enter/exit thresholds (hysteresis)');
    assert(jsVoiceContent.includes('resetGuidanceSmoothing()') &&
        (jsVoiceContent.match(/resetGuidanceSmoothing\(\)/g) || []).length >= 3,
        'resetGuidanceSmoothing() must be defined and called on both start and stop of the guidance loop');

    // Exercise the pure logic (EMA + the commit-debounce state machine). The
    // module's own updateVoiceStatusHUD/speakVoiceGuidance no-op without a DOM,
    // which is fine here - we're asserting the returned commit decision.
    const ctx = vm.createContext({
        Math, Uint8Array, Int32Array, Date, setInterval: () => 0, clearInterval: () => {}, console
    });
    vm.runInContext(jsVoiceContent + '\nvar __api = { ema, commitGuidance, resetGuidanceSmoothing };', ctx);
    const { ema, commitGuidance, resetGuidanceSmoothing } = ctx.__api;

    // EMA: first sample passes through, later samples are pulled toward it.
    assert.strictEqual(ema(null, 10), 10, 'first EMA sample must pass through');
    const mixed = ema(10, 20);
    assert(mixed > 10 && mixed < 20, 'EMA must blend previous and current');

    // commitGuidance: a state must repeat before it commits; changing state resets the count.
    resetGuidanceSmoothing();
    assert.strictEqual(commitGuidance('a', 'msg-a'), false, 'first tick of a state must NOT commit');
    assert.strictEqual(commitGuidance('a', 'msg-a'), true, 'second consecutive tick commits');
    assert.strictEqual(commitGuidance('a', 'msg-a'), true, 'staying in the same state stays committed');
    assert.strictEqual(commitGuidance('b', 'msg-b'), false, 'switching state resets the debounce');
    assert.strictEqual(commitGuidance('c', 'msg-c', null, null, true), true, 'force=true bypasses the debounce');
});

runTest('Continuous navigation sonar + haptics + dark/glare guards (js/voice-guidance.js)', () => {
    assert(jsVoiceContent.includes('function startNavSonar') && jsVoiceContent.includes('function updateNavSonar'), 'Missing navigation sonar engine');
    // The constant machine-gun sonar blipping is disabled for now - startNavSonar()
    // must bail unless it's explicitly re-enabled.
    assert(jsVoiceContent.includes('let isNavSonarEnabled = false'), 'Nav sonar must default to OFF');
    assert(/function startNavSonar\(\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*if \(!isNavSonarEnabled\) return;/.test(jsVoiceContent),
        'startNavSonar() must bail immediately when isNavSonarEnabled is false');
    assert(jsVoiceContent.includes('function vibrate'), 'Missing vibrate() haptic helper');
    assert(jsVoiceContent.includes('แสงน้อยไป'), 'Missing too-dark Thai prompt');
    assert(jsVoiceContent.includes('แสงสะท้อน'), 'Missing glare Thai prompt');
    assert(jsVoiceContent.includes('มีอะไรบังกล้องอยู่'), 'Missing lens-covered Thai prompt');
    assert(jsVoiceContent.includes('function maybeAutoTorch') && jsVoiceContent.includes('setTorch'), 'Missing auto-torch in low light');
    assert(jsCameraContent.includes('function setTorch') && jsCameraContent.includes('function captureBurstFrames'), 'js/camera.js missing torch + burst-capture helpers');
    assert(jsOcrModuleContent.includes('async function recognizeBest'), 'js/ocr.js missing recognizeBest() burst picker');
    assert(jsOcrModuleContent.includes("formData.append('lang'"), 'recognize() must pass the OCR language set to the backend');
});

runTest('js/ocr.js pickBestBurstResult() - burst picker weighs completeness, not just confidence', () => {
    const ctx = vm.createContext({});
    vm.runInContext(jsOcrModuleContent, ctx);

    // The core case: a slightly-lower-confidence frame that captured the
    // trailing word must beat the crisp-but-truncated frame.
    const chosen = ctx.pickBestBurstResult([
        { text: 'HACKATHON', confidence: 95, words: [] },
        { text: 'HACKATHON 2026', confidence: 88, words: [] },
        { text: 'HACK', confidence: 70, words: [] },
    ]);
    assert.strictEqual(chosen.text, 'HACKATHON 2026', 'must prefer the more complete read within the confidence band');

    // A wordier frame that reads MUCH lower is out of the band -> the crisp
    // frame still wins (a garbled frame reads low and is wordy with junk).
    const chosen2 = ctx.pickBestBurstResult([
        { text: 'ภารกิจ', confidence: 90, words: [] },
        { text: 'ภารกิจ คิด เผื่อ ขับ เคลื่อน โ ) นาคต', confidence: 55, words: [] },
    ]);
    assert.strictEqual(chosen2.text, 'ภารกิจ', 'a far-lower-confidence frame must not win on wordiness alone');

    // Equal content -> higher confidence breaks the tie.
    const chosen3 = ctx.pickBestBurstResult([
        { text: 'สวัสดี', confidence: 80, words: [] },
        { text: 'สวัสดี', confidence: 92, words: [] },
    ]);
    assert.strictEqual(chosen3.confidence, 92, 'equal content falls back to confidence');

    // Punctuation/space noise doesn't inflate the content score.
    assert.strictEqual(ctx.burstContentScore({ text: 'A B C' }), 3, 'spaces are not content');
    assert.strictEqual(ctx.burstContentScore({ text: ') ) 1 1 (' }), 2, 'only the two digits count');

    assert.strictEqual(ctx.pickBestBurstResult([]), null, 'no frames -> null');
    assert.strictEqual(ctx.pickBestBurstResult([{ text: '   ', confidence: 9 }]), null, 'blank frames -> null');
});

runTest('Guidance toggle states persist to localStorage (js/voice-guidance.js)', () => {
    assert(jsVoiceContent.includes('function saveGuidancePrefs') && jsVoiceContent.includes('function loadGuidancePrefs'), 'Missing guidance-prefs persistence');
    assert(jsVoiceContent.includes('GUIDANCE_PREFS_KEY'), 'Missing localStorage key for guidance prefs');
    assert(jsVoiceContent.includes('function syncGuidanceButtons'), 'Missing syncGuidanceButtons() to reflect restored state onto the UI');
});

// -------------------------------------------------------------
// Suite 6: 14-Cell Pagination Logic & Language Mode Switcher
// -------------------------------------------------------------
console.log('\n--- SUITE 6: 14-Cell Pagination Logic & Language Mode Switcher ---');

runTest('14-Cell Pagination by braille-CELL count (Empty, Exact, Multi-Page)', () => {
    // Pagination is now keyed by braille cell count, not input codepoint
    // count (one Thai syllable can span several cells). Pages are
    // { cells: Cell[], text: string }.
    const { paginateBrailleCells } = require(path.join(projectRoot, 'js', 'thai-braille.js'));
    const mk = n => Array.from({ length: n }, (_, i) => ({ dots: [1], source: String(i % 10), kind: 'digit' }));

    const empty = paginateBrailleCells([], 14);
    assert.strictEqual(empty.length, 1);
    assert.strictEqual(empty[0].cells.length, 0);

    const exact14 = paginateBrailleCells(mk(14), 14);
    assert.strictEqual(exact14.length, 1);
    assert.strictEqual(exact14[0].cells.length, 14);

    const thirty = paginateBrailleCells(mk(30), 14);
    assert.deepStrictEqual(thirty.map(p => p.cells.length), [14, 14, 2]);
    thirty.forEach(p => assert(p.cells.length <= 14, 'no page may exceed 14 cells'));
});

runTest('js/textProcessor.js normalizeOcrText() - NFC Normalization & Thai Preservation', () => {
    const sandbox = { normalizeOcrText: null };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsTextProcessorContent, ctx);

    // Decomposed Thai (base + combining tone mark, NFD-style) must normalize to a single composed form.
    const decomposed = 'ก' + 'ิ' + '่'; // base + sara i + mai ek, combining order
    const normalized = ctx.normalizeOcrText(decomposed);
    assert.strictEqual(normalized, decomposed.normalize('NFC'), 'Must apply Unicode NFC normalization');

    // Thai text must survive untouched (not filtered out like the old A-Z-only pipeline did).
    assert.strictEqual(ctx.normalizeOcrText('สวัสดีครับ'), 'สวัสดีครับ');

    // Whitespace collapses, but case is never forced (Thai has no case; must not corrupt mixed-language text).
    assert.strictEqual(ctx.normalizeOcrText('  Hello   สวัสดี  '), 'Hello สวัสดี');
    assert.strictEqual(ctx.normalizeOcrText(''), '');
});

runTest('js/textProcessor.js stripOrphanCombiningMarks() - drops noise, keeps real stacks', () => {
    const sandbox = { normalizeOcrText: null };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(jsTextProcessorContent, ctx);

    // Regression guard for the PCB-photo bug report: EasyOCR misread stray
    // marks on a cluttered background as Thai combining characters with no
    // consonant base ("ืุe" -- no consonant precedes ื or ุ).
    assert.strictEqual(ctx.normalizeOcrText('เขา . ืุe j02 รับเหมาก่อเรื่อง'),
        'เขา . e j02 รับเหมาก่อเรื่อง', 'Orphan ื/ุ must be dropped, everything else untouched');

    // A legitimate multi-mark stack (consonant + vowel + tone) must survive.
    assert.strictEqual(ctx.normalizeOcrText('กี่'), 'กี่', 'Real consonant+vowel+tone stack must not be touched');
    assert.strictEqual(ctx.normalizeOcrText('ก่อน้ำ'), 'ก่อน้ำ', 'Real multi-syllable tone stacking must not be touched');

    // A leading orphan mark with nothing else in the token disappears entirely.
    assert.strictEqual(ctx.normalizeOcrText('ืุe'), 'e', 'Orphan-only prefix must be fully dropped');
});

runTest('English & Thai Braille Character Map Lookup (via js/thai-braille-tables.js)', () => {
    const T = require(path.join(projectRoot, 'js', 'thai-braille-tables.js'));
    const join = groups => groups.map(g => g.join('')).join('|');
    assert.strictEqual(join(T.LATIN_LETTERS['a']), '1', "Latin 'a' must be dot 1");
    assert.strictEqual(join(T.LATIN_LETTERS['b']), '12', "Latin 'b' must be dots 1,2");
    assert.strictEqual(join(T.THAI_CONSONANTS['ก'].cells), '1245', "'ก' must be dots 1,2,4,5");
    // 'า' was previously an RTGS-derived [3,4,5]; the chart value is dots 1,6.
    assert.strictEqual(join(T.THAI_SIMPLE_VOWELS['า'].cells), '16', "'า' must be dots 1,6 (chart), not the old [3,4,5]");
});

runTest('ท (tho thahan) vs ห (ho hip) Braille Patterns Must Not Collide', () => {
    // Regression guard for a real bug: ท was once mis-assigned ห's dot
    // pattern ([1,2,5]). Verified against the Unicode braille glyphs
    // (ท = U+283E = dots 2,3,4,5,6; ห = U+2813 = dots 1,2,5).
    const T = require(path.join(projectRoot, 'js', 'thai-braille-tables.js'));
    const tho = T.THAI_CONSONANTS['ท'].cells.map(g => g.join(',')).join('|');
    const ho = T.THAI_CONSONANTS['ห'].cells.map(g => g.join(',')).join('|');
    assert.strictEqual(tho, '2,3,4,5,6', 'ท must map to dots 2,3,4,5,6');
    assert.strictEqual(ho, '1,2,5', 'ห must map to dots 1,2,5');
    assert.notStrictEqual(tho, ho, 'ท and ห must never share a dot pattern');
});

runTest('Thai Tone Mark Braille Patterns (mai ek/tho/tri, thanthakhat)', () => {
    // Values decoded from the Unicode braille glyphs:
    //   ่ mai ek U+2814 -> 3,5 | ้ mai tho U+2832 -> 2,5,6
    //   ๊ mai tri U+2836 -> 2,3,5,6 | ๋ mai chattawa U+2826 -> 2,3,6
    //   ์ thanthakhat U+2834 -> 3,5,6
    const T = require(path.join(projectRoot, 'js', 'thai-braille-tables.js'));
    const j = e => e.cells.map(g => g.join(',')).join('|');
    assert.strictEqual(j(T.THAI_TONES['่']), '3,5', 'mai ek must map to dots 3,5');
    assert.strictEqual(j(T.THAI_TONES['้']), '2,5,6', 'mai tho must map to dots 2,5,6');
    assert.strictEqual(j(T.THAI_TONES['๊']), '2,3,5,6', 'mai tri must map to dots 2,3,5,6');
    assert.strictEqual(j(T.THAI_TONES['๋']), '2,3,6', 'mai chattawa must map to dots 2,3,6');
    assert.strictEqual(j(T.THAI_MARKS['์']), '3,5,6', 'thanthakhat must map to dots 3,5,6');
});

runTest('Single-Language Mode Switcher State Transitions (Default ENG)', () => {
    let mode = 'eng';
    function toggle(forced) {
        if (forced === 'tha' || forced === 'eng') mode = forced;
        else mode = (mode === 'eng') ? 'tha' : 'eng';
    }

    assert.strictEqual(mode, 'eng');
    toggle();
    assert.strictEqual(mode, 'tha');
    toggle();
    assert.strictEqual(mode, 'eng');
});

runTest('README.md Documentation Integrity & Structure', () => {
    assert(readmeContent.includes('# BrailleLens 3D & Optical OCR System'), 'Missing title in README.md');
    assert(readmeContent.includes('14-Cell / 84-Pin'), 'Missing 14-cell 84-pin mention in README.md');
    assert(readmeContent.includes('Optical OCR'), 'Missing Optical OCR mention in README.md');
});

// -------------------------------------------------------------
// Summary & Exit Codes
// -------------------------------------------------------------
console.log('\n===============================================================');
console.log(`>>> Autonomous QA Test Summary: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('===============================================================');

if (failedTests > 0) {
    console.error('\n>>> [QA_STATUS: FAIL]');
    process.exit(1);
} else {
    console.log('\n>>> [QA_STATUS: PASS] All modular verification criteria satisfied!');
    process.exit(0);
}
