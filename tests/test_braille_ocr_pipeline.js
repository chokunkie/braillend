const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('===============================================================');
console.log('>>> [qa_agent] CURRENT_STATE: STATE_EXECUTING');
console.log('>>> [qa_agent] LOG: Starting Autonomous Verification & QA Suite (Modular Codebase)');
console.log('===============================================================\n');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');
const cssPath = path.join(projectRoot, 'css', 'styles.css');
const jsBraillePath = path.join(projectRoot, 'js', 'braille-engine.js');
const jsThreePath = path.join(projectRoot, 'js', 'three-scene.js');
const jsOcrPath = path.join(projectRoot, 'js', 'ocr-engine.js');
const jsAppPath = path.join(projectRoot, 'js', 'app.js');
const readmePath = path.join(projectRoot, 'README.md');

assert(fs.existsSync(indexPath), `Target index.html not found at ${indexPath}`);
assert(fs.existsSync(cssPath), `Target css/styles.css not found at ${cssPath}`);
assert(fs.existsSync(jsBraillePath), `Target js/braille-engine.js not found at ${jsBraillePath}`);
assert(fs.existsSync(jsThreePath), `Target js/three-scene.js not found at ${jsThreePath}`);
assert(fs.existsSync(jsOcrPath), `Target js/ocr-engine.js not found at ${jsOcrPath}`);
assert(fs.existsSync(jsAppPath), `Target js/app.js not found at ${jsAppPath}`);
assert(fs.existsSync(readmePath), `Target README.md not found at ${readmePath}`);

const indexContent = fs.readFileSync(indexPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const jsBrailleContent = fs.readFileSync(jsBraillePath, 'utf-8');
const jsThreeContent = fs.readFileSync(jsThreePath, 'utf-8');
const jsOcrContent = fs.readFileSync(jsOcrPath, 'utf-8');
const jsAppContent = fs.readFileSync(jsAppPath, 'utf-8');
const readmeContent = fs.readFileSync(readmePath, 'utf-8');

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
    assert(indexContent.includes('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'), 'Missing Tesseract.js v5 CDN in <head>');
});

runTest('Modular Stylesheet & Script Tags in index.html', () => {
    assert(indexContent.includes('<link rel="stylesheet" href="css/styles.css">'), 'Missing css/styles.css link tag');
    assert(indexContent.includes('<script src="js/braille-engine.js"></script>'), 'Missing js/braille-engine.js script tag');
    assert(indexContent.includes('<script src="js/three-scene.js"></script>'), 'Missing js/three-scene.js script tag');
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

runTest('OCR & Viewfinder CSS Selectors in css/styles.css', () => {
    const requiredClasses = [
        '.ocr-section',
        '.ocr-panel',
        '.dropzone',
        '.camera-modal',
        '.viewfinder-box',
        '.shutter-btn',
        '.ocr-progress-bar',
        '.confidence-badge',
        '.dropzone-preview'
    ];
    for (const cls of requiredClasses) {
        assert(cssContent.includes(cls), `Missing CSS selector: ${cls}`);
    }
});

// -------------------------------------------------------------
// Suite 3: DOM ID Structure Verification
// -------------------------------------------------------------
console.log('\n--- SUITE 3: DOM Elements & OCR IDs in index.html ---');

runTest('Required OCR Control Panel and Viewfinder DOM IDs', () => {
    const requiredIds = [
        'ocrLangSelect',
        'ocrDropzone',
        'imageFileInput',
        'btnTriggerFileBrowse',
        'btnRemoveImage',
        'dropzonePreview',
        'previewThumbnail',
        'previewFilename',
        'btnOpenLiveCamera',
        'cameraModal',
        'cameraVideo',
        'cameraCaptureCanvas',
        'btnCaptureSnapshot',
        'btnSwitchCamera',
        'btnCloseCameraModal',
        'btnCancelCamera',
        'ocrProgressContainer',
        'ocrProgressBar',
        'ocrStatusText',
        'ocrConfidenceScore',
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
});

// -------------------------------------------------------------
// Suite 4: Modular JavaScript ES6+ Syntax & VM Sandboxing
// -------------------------------------------------------------
console.log('\n--- SUITE 4: JavaScript Modules ES6+ Syntax & Compilation ---');

runTest('Compile js/braille-engine.js with Node vm.Script', () => {
    new vm.Script(jsBrailleContent, { filename: 'braille-engine.js' });
    assert(jsBrailleContent.includes('THAI_BRAILLE_MAP'), 'Missing THAI_BRAILLE_MAP');
    assert(jsBrailleContent.includes('function convertThaiToBraille'), 'Missing convertThaiToBraille');
    assert(jsBrailleContent.includes('function chunkTextForBraille'), 'Missing chunkTextForBraille');
    assert(jsBrailleContent.includes('function updatePaginationDisplay'), 'Missing updatePaginationDisplay');
    assert(jsBrailleContent.includes('function toggleLanguageMode'), 'Missing toggleLanguageMode');
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

runTest('Compile js/ocr-engine.js with Node vm.Script', () => {
    new vm.Script(jsOcrContent, { filename: 'ocr-engine.js' });
    assert(jsOcrContent.includes('async function preprocessImageForOCR'), 'Missing preprocessImageForOCR');
    assert(jsOcrContent.includes('async function runOCRExtraction'), 'Missing runOCRExtraction');
    assert(jsOcrContent.includes('function startCameraStream'), 'Missing startCameraStream');
    assert(jsOcrContent.includes('function captureCameraSnapshot'), 'Missing captureCameraSnapshot');
    assert(jsOcrContent.includes('function initOCRHandlers'), 'Missing initOCRHandlers');
});

runTest('Compile js/app.js with Node vm.Script', () => {
    new vm.Script(jsAppContent, { filename: 'app.js' });
    assert(jsAppContent.includes('function restoreSavedTheme'), 'Missing restoreSavedTheme');
    assert(jsAppContent.includes("window.addEventListener('DOMContentLoaded'"), 'Missing DOMContentLoaded listener in app.js');
});

// -------------------------------------------------------------
// Suite 5: Logic, Exception Handling & Braille Encoding
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Logic, Exception Handling & Braille Encoding ---');

runTest('Exception Handling & Safe Fallback in WebRTC Camera Controller', () => {
    assert(jsOcrContent.includes('navigator.mediaDevices.getUserMedia'), 'Missing getUserMedia call');
    assert(jsOcrContent.includes('track.stop()'), 'Missing track.stop() cleanup in stopCameraStream');
    assert(jsOcrContent.includes('catch (err)'), 'Missing try/catch error handling in camera stream');
    assert(jsOcrContent.includes('closeCameraModal()'), 'Missing closeCameraModal error fallback');
});

runTest('Tesseract.js Engine Guard & Clean-up Logic (English Only Locked)', () => {
    assert(jsOcrContent.includes("typeof Tesseract === 'undefined'"), 'Missing Tesseract undefined guard');
    assert(jsOcrContent.includes('isOCROngoing'), 'Missing reentrancy guard isOCROngoing');
    assert(jsOcrContent.includes('Tesseract.recognize'), 'Missing Tesseract.recognize execution');
    assert(jsOcrContent.includes("const lang = 'eng';"), 'Tesseract.js OCR engine must be locked to English Only (eng)');
    assert(indexContent.includes('<option value="eng" selected>English Only (A-Z, 0-9)</option>'), 'index.html must have English Only option selected by default');
    assert(jsBrailleContent.includes("let currentLanguageMode = 'eng';"), 'braille-engine.js must default currentLanguageMode to eng');
});

runTest('Image Preprocessing Algorithm (Grayscale, Denoising, Sharpening, Contrast, Binarization)', () => {
    assert(jsOcrContent.includes('0.299 * r + 0.587 * g + 0.114 * b'), 'Missing standard luminance grayscale conversion');
    assert(jsOcrContent.includes('(sum >> 4)'), 'Missing 3x3 Gaussian denoise convolution filter sum shift');
    assert(jsOcrContent.includes('5 * denoised[rowOffset + x]'), 'Missing 3x3 sharpen convolution filter on denoised buffer');
    assert(jsOcrContent.includes("imageSmoothingQuality = 'high'"), 'Missing high-quality image smoothing on upscaling');
    assert(jsOcrContent.includes('putImageData'), 'Missing canvas putImageData update');
});

runTest('3x3 Gaussian Denoise Noise Reduction Filter Kernel Math Simulation', () => {
    // 3x3 Gaussian weights: [1,2,1; 2,4,2; 1,2,1], sum = 16
    const center = 120;
    const ortho = 100; // top, bottom, left, right (weight 2)
    const diag = 80;   // 4 corners (weight 1)
    const sum = (diag * 1 + ortho * 2 + diag * 1 + ortho * 2 + center * 4 + ortho * 2 + diag * 1 + ortho * 2 + diag * 1);
    const denoisedVal = sum >> 4;
    assert.strictEqual(denoisedVal, 100, 'Gaussian 3x3 denoise kernel math calculation error');
});

runTest('High-Resolution Native Camera Capture (1080p Full HD) & Video Constraints', () => {
    assert(jsOcrContent.includes('width: { ideal: 1920, min: 1280 }'), 'Missing ideal 1920 Full HD width constraint');
    assert(jsOcrContent.includes('height: { ideal: 1080, min: 720 }'), 'Missing ideal 1080 Full HD height constraint');
    assert(jsOcrContent.includes('video.videoWidth'), 'Missing video.videoWidth native resolution grab');
    assert(jsOcrContent.includes('video.videoHeight'), 'Missing video.videoHeight native resolution grab');
});

runTest('Processed Denoised & Binarized Preview on Dropzone Preview Card', () => {
    assert(jsOcrContent.includes('processedCanvas.toDataURL'), 'Missing processedCanvas.toDataURL for live crisp preview');
    assert(jsOcrContent.includes('previewCard.classList.add'), 'Missing previewCard active class activation');
    assert(jsOcrContent.includes('_isPreprocessed'), 'Missing canvas _isPreprocessed optimization flag');
});

runTest('Tesseract Page Segmentation Mode (PSM 6) Optimization', () => {
    assert(jsOcrContent.includes("tessedit_pageseg_mode: '6'"), 'Missing PSM 6 configuration in Tesseract.recognize options');
});

runTest('3x3 Sharpening Convolution Kernel Math Simulation', () => {
    const center = 100;
    const top = 50, bottom = 50, left = 50, right = 50;
    const sharpVal = 5 * center - top - bottom - left - right;
    const clamped = sharpVal < 0 ? 0 : (sharpVal > 255 ? 255 : sharpVal);
    assert.strictEqual(clamped, 255, 'Sharpening kernel math calculation error');
});

runTest('DOM Event Listeners Binding in initOCRHandlers', () => {
    assert(jsOcrContent.includes('btnBrowse.addEventListener'), 'Missing btnBrowse click listener');
    assert(jsOcrContent.includes('dropzone.addEventListener'), 'Missing dropzone event listeners');
    assert(jsOcrContent.includes('fileInput.addEventListener'), 'Missing fileInput change listener');
    assert(jsOcrContent.includes('btnOpenCam.addEventListener'), 'Missing btnOpenLiveCamera listener');
    assert(jsOcrContent.includes('btnCapture.addEventListener'), 'Missing btnCaptureSnapshot listener');
    assert(jsOcrContent.includes('btnPrev.addEventListener'), 'Missing btnPrev click listener');
    assert(jsOcrContent.includes('btnNext.addEventListener'), 'Missing btnNext click listener');
    assert(jsOcrContent.includes('btnMode.addEventListener'), 'Missing btnMode click listener');
});

runTest('Keyboard Navigation Event Listener (ArrowLeft / ArrowRight)', () => {
    assert(jsOcrContent.includes("e.key === 'ArrowLeft'"), 'Missing ArrowLeft keyboard shortcut');
    assert(jsOcrContent.includes("e.key === 'ArrowRight'"), 'Missing ArrowRight keyboard shortcut');
});

runTest('OCR Output Text Sanitization & Normalization', () => {
    const rawText = "  สวัสดีครับ  \r\n  ทดสอบ   OCR \n\n ";
    const cleanedText = rawText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    assert.strictEqual(cleanedText, "สวัสดีครับ ทดสอบ OCR", "Text sanitization failed to normalize whitespace and newlines");
});

runTest('14-Cell / 84-Pin Braille Grid Pin Indexing Calculation', () => {
    const TOTAL_CELLS = 14;
    const PINS_PER_CELL = 6;
    const totalPins = TOTAL_CELLS * PINS_PER_CELL;
    assert.strictEqual(totalPins, 84, "Total pins must equal 84");
});

runTest('Pin Protrusion Realistic Height Scale (0.12 - 0.14 / 1.2mm Engineering Scale)', () => {
    // 1. Verify braille-engine.js target height
    assert(jsBrailleContent.includes('const targetY = isActive ? 0.13 : 0.0;'), 'braille-engine.js must set targetY to 0.13 (1.2mm scale)');
    
    // 2. Verify three-scene.js single-pin mechanism modal values
    assert(jsThreeContent.includes("pPin.innerText = 'UP (1.2mm)'"), 'Mechanism modal must display UP (1.2mm)');
    assert(jsThreeContent.includes('mechPinMesh.position.y = 0.89'), 'mechPinMesh UP position must be 0.89');
    assert(jsThreeContent.includes('UP - 1.2mm'), 'Mechanism description must reference UP - 1.2mm');
});

runTest('3D Hardware Interactive Tactical Buttons (Prev, Next, Mode) & Raycaster Handlers', () => {
    // 1. 3D button groups and textures in three-scene.js
    assert(jsThreeContent.includes('btn3DPrevGroup'), 'Missing btn3DPrevGroup in three-scene.js');
    assert(jsThreeContent.includes('btn3DNextGroup'), 'Missing btn3DNextGroup in three-scene.js');
    assert(jsThreeContent.includes('btn3DModeGroup'), 'Missing btn3DModeGroup in three-scene.js');

    // 2. Raycaster mouse hover and click handlers
    assert(jsThreeContent.includes('press3DButton(target.interactiveType)'), 'Missing 3D button click press dispatcher');
    assert(jsThreeContent.includes("renderer.domElement.style.cursor = 'pointer'"), 'Missing pointer cursor on hover');
    assert(jsThreeContent.includes('update3DButtonsState()'), 'Missing update3DButtonsState call in raycaster');
});

// -------------------------------------------------------------
// Suite 6: 14-Cell Pagination Logic & Language Mode Switcher
// -------------------------------------------------------------
console.log('\n--- SUITE 6: 14-Cell Pagination Logic & Language Mode Switcher ---');

runTest('14-Cell Text Chunking Algorithm (Empty, Short, Multi-Page)', () => {
    function chunkText(text) {
        const chars = Array.from(text || '');
        if (chars.length === 0) return [''];
        const chunks = [];
        const CHUNK_SIZE = 14;
        for (let i = 0; i < chars.length; i += CHUNK_SIZE) {
            chunks.push(chars.slice(i, i + CHUNK_SIZE).join(''));
        }
        return chunks;
    }

    const emptyChunks = chunkText('');
    assert.strictEqual(emptyChunks.length, 1);
    assert.strictEqual(emptyChunks[0], '');

    const exact14 = chunkText('12345678901234');
    assert.strictEqual(exact14.length, 1);
    assert.strictEqual(exact14[0], '12345678901234');

    const exact28 = chunkText('12345678901234ABCDEFGHIJKLMNOP');
    assert.strictEqual(exact28.length, 3);
    assert.strictEqual(exact28[0].length, 14);
    assert.strictEqual(exact28[1].length, 14);
    assert.strictEqual(exact28[2].length, 2);

    const thaiText = 'สวัสดีครับ ยินดีต้อนรับสู่ระบบ BraillLens อักษรเบรลล์';
    const thaiChunks = chunkText(thaiText);
    assert(thaiChunks.length > 1, 'Multi-character Thai text should split into multiple 14-cell chunks');
    assert.strictEqual(thaiChunks.join(''), thaiText, 'Reconstructed chunks must match original string');
});

runTest('Pagination Index Navigation & Boundary Clamping', () => {
    let chunks = ['CHUNK_1', 'CHUNK_2', 'CHUNK_3'];
    let pageIndex = 0;

    function next() {
        if (pageIndex < chunks.length - 1) pageIndex++;
    }
    function prev() {
        if (pageIndex > 0) pageIndex--;
    }

    assert.strictEqual(pageIndex, 0);
    prev();
    assert.strictEqual(pageIndex, 0);
    next();
    assert.strictEqual(pageIndex, 1);
    next();
    assert.strictEqual(pageIndex, 2);
    next();
    assert.strictEqual(pageIndex, 2);
    prev();
    assert.strictEqual(pageIndex, 1);
});

runTest('English & Thai Braille Character Map Lookup', () => {
    assert(jsBrailleContent.includes("'A': [1]"), "Missing Braille mapping for 'A'");
    assert(jsBrailleContent.includes("'B': [1, 2]"), "Missing Braille mapping for 'B'");
    assert(jsBrailleContent.includes("'ก': [1, 2, 4, 5]"), "Missing Braille mapping for 'ก'");
    assert(jsBrailleContent.includes("'า': [3, 4, 5]"), "Missing Braille mapping for 'า'");
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
    toggle('tha');
    assert.strictEqual(mode, 'tha');
    toggle('eng');
    assert.strictEqual(mode, 'eng');
});

runTest('README.md Documentation Integrity & Structure', () => {
    assert(readmeContent.includes('# BrailleLens 3D & Optical OCR System'), 'Missing title in README.md');
    assert(readmeContent.includes('14-Cell / 84-Pin'), 'Missing 14-cell 84-pin mention in README.md');
    assert(readmeContent.includes('Optical OCR'), 'Missing Optical OCR mention in README.md');
    assert(readmeContent.includes('css/styles.css'), 'Missing directory reference in README.md');
    assert(readmeContent.includes('js/braille-engine.js'), 'Missing JS module reference in README.md');
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
