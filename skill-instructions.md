# BraillLens 3D - Skill & Operational Instructions
Version: 3.0.0 (Sovereign Logic Standard)

---

## 1. Role & Operational Philosophy
All subagents and developers operating on this repository must adhere to the **Sovereign Logic V3.0 Standard**:
- **Simplicity & Surgical Edits**: Keep changes contained, minimal, and goal-driven.
- **Zero Autonomous Looping**: Do not run uncontrolled infinite loops.
- **Self-Correction Limit (Max 3 Times)**: When errors occur during execution or tests, analyze logs and attempt self-correction up to 3 times. If unresolvable, escalate with a structured summary to the Manager.
- **Mandatory CLI Streaming Format**:
  Every action, completion, or error must emit a 3-line CLI stream status:
  ```text
  >>> [agent_name] CURRENT_STATE: [STATE_IDLE | STATE_PLANNING | STATE_EXECUTING | STATE_SELF_CORRECTING | STATE_ESCALATING]
  >>> [agent_name] LOG: [Brief description of current action or error]
  >>> [agent_name] NEXT_STATE: [Target state]
  ```

---

## 2. Workspace Conventions
- **Primary Source File**: `BraillLens_Interactive_3D.html` (Standalone single-file application).
- **Core Libraries**: Three.js r128, OrbitControls, FontAwesome 6, Tesseract.js v5 CDN.
- **No Build Step**: The project must remain instantly runnable in any modern web browser by double-clicking or serving via a basic static server (`python -m http.server` or `npx serve`).
- **CSS Architecture**: Pure CSS variables (`--bg-dark`, `--accent-cyan`, `--accent-emerald`, etc.) supporting seamless Dark / Light mode transitions.

---

## 3. OCR Implementation Directives

### 3.1 Preprocessing Pipeline Standard
Always route incoming images through the Canvas 2D Preprocessor before feeding into Tesseract.js:
1. Scale image if dimensions are too small (< 300px) or excessively large (> 2048px) to optimize OCR worker memory.
2. Apply Grayscale and Contrast Normalization.
3. Provide an intuitive visual preview in the UI for user feedback.

### 3.2 WebRTC Camera Stream Handling
1. Request video constraints `{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }`.
2. Catch permission errors (`NotAllowedError`, `NotFoundError`) and display clean, user-friendly error banners.
3. Always stop all media tracks when camera modal is closed:
   ```javascript
   if (cameraStream) {
       cameraStream.getTracks().forEach(track => track.stop());
       cameraStream = null;
   }
   ```

### 3.3 Translation Pipeline Hook
Upon OCR completion:
1. Clean unrecognized non-printable characters while preserving Thai consonants, vowels, tone marks, English letters, digits, and spaces.
2. Update the `thaiInput` element value.
3. Automatically invoke `updateBrailleDisplay(text)` to refresh 3D pins, 3D OLED screen texture, and 2D matrix cards.

---

## 4. Autonomous Verification & Testing Recipes

### 4.1 Headless / Browser-less Node.js Verification
When testing Braille conversion logic or mapping correctness:
```bash
node -e "
const { convertThaiToBraille } = require('./test-helper.js');
console.assert(convertThaiToBraille('สวัสดี').length === 14);
console.log('Thai Braille mapping test passed');
"
```

### 4.2 DOM & Syntax Integrity Verification
Verify HTML syntax and script block integrity:
```powershell
Get-Content .\BraillLens_Interactive_3D.html | Select-String -Pattern "<script>"
```
Ensure all tags and script closures are intact.
