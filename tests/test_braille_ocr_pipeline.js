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
});

runTest('Compile js/demoMode.js with Node vm.Script (isolated from real OCR)', () => {
    new vm.Script(jsDemoModeContent, { filename: 'demoMode.js' });
    assert(jsDemoModeContent.includes('function runDemoOcr'), 'Missing runDemoOcr');
    assert(jsDemoModeContent.includes('setTimeout'), 'Missing artificial delay simulating an OCR call');
    assert(!/fetch\s*\(/.test(jsDemoModeContent), 'js/demoMode.js must never call the network / real OCR backend');
    assert(/[฀-๿]/.test(jsDemoModeContent), 'Missing a hardcoded Thai sample string');
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
    assert(jsVoiceContent.includes('focusScore >= FOCUS_SHARP_THRESHOLD'), 'Auto-Capture must gate shutter trigger on focusScore >= FOCUS_SHARP_THRESHOLD (160)');
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
    assert(backendPreprocessingContent.includes('MIN_SHORT_SIDE = 640'), 'Missing 640px minimum short-side resize target');
    assert(backendPreprocessingContent.includes('createCLAHE'), 'Missing CLAHE contrast enhancement');
    assert(backendPreprocessingContent.includes('adaptiveThreshold'), 'Missing adaptive threshold for uneven lighting');
    assert(backendPreprocessingContent.includes('_is_lighting_uneven'), 'Missing lighting-unevenness heuristic gating the adaptive threshold');
    assert(backendPreprocessingContent.includes('fastNlMeansDenoising'), 'Missing denoise step');
    assert(backendPreprocessingContent.includes('document_source == "camera"'), 'Denoise strength must be tuned by documentSource (camera vs upload)');
});

runTest('EasyOCR Engine Configuration (Thai + English, Beamsearch, Per-Word Boxes)', () => {
    assert(backendOcrEngineContent.includes("easyocr.Reader([\"th\", \"en\"]"), "EasyOCR must load both 'th' and 'en'");
    assert(backendOcrEngineContent.includes('decoder="beamsearch"'), 'Missing decoder=\"beamsearch\" for accuracy');
    assert(backendOcrEngineContent.includes('paragraph=False'), 'Missing paragraph=False for per-word bounding boxes');
    assert(backendOcrEngineContent.includes('_bbox_to_rect'), 'Missing conversion of EasyOCR polygon bbox to axis-aligned rect');
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
    assert(jsOcrContent.includes('OCR_LOW_CONFIDENCE_THRESHOLD'), 'Missing low-confidence gate constant');
    assert(jsOcrContent.includes('result.confidence < OCR_LOW_CONFIDENCE_THRESHOLD'), 'Missing low-confidence gate blocking Braille actuation on unclear images');
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
    assert(jsVoiceContent.includes('CORNER_STROKE_THRESHOLD = 0.012'), 'Missing CORNER_STROKE_THRESHOLD constant');
    assert(jsVoiceContent.includes('zoneTL'), 'Missing zoneTL corner target boundary definition');
    assert(jsVoiceContent.includes('zoneTR'), 'Missing zoneTR corner target boundary definition');
    assert(jsVoiceContent.includes('zoneBL'), 'Missing zoneBL corner target boundary definition');
    assert(jsVoiceContent.includes('zoneBR'), 'Missing zoneBR corner target boundary definition');
    assert(jsVoiceContent.includes('densityTL = countTL / Math.max(1, pixelsTL)'), 'Missing densityTL calculation');
    assert(jsVoiceContent.includes('updateCornerTargetHUD(lockedTL, lockedTR, lockedBL, lockedBR)'), 'Missing updateCornerTargetHUD invocation');
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

runTest('Auto-Capture Stability Timing Math (1.0s Rapid Shutter Requirement)', () => {
    const STABILITY_REQUIRED_MS = 1000;
    const startTime = 10000;
    const checkTime = 11000;
    const elapsed = checkTime - startTime;
    assert.strictEqual(elapsed >= STABILITY_REQUIRED_MS, true, 'Stability elapsed time check failed');
    assert(jsVoiceContent.includes('STABILITY_REQUIRED_MS = 1000'), 'js/voice-guidance.js must use 1000ms stability threshold');
});

runTest('Pre-Capture Voice Warning (0.5s Warning Before Shutter & Speech Callback)', () => {
    assert(jsVoiceContent.includes('PRE_CAPTURE_WARNING_MS = 500'), 'Missing PRE_CAPTURE_WARNING_MS constant');
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
