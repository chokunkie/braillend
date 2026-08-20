/* =========================================================================
   BraillLens 3D & Optical OCR System - 3D Real-World Presentation Simulation
   Full 3D scene camera navigation, 3D device screen scanning HUD,
   voice guidance prompts, and physical 84-pin 3D actuation line-by-line.
   ========================================================================= */

const REAL_SIM_LINES = [
    "สวัสดีครับ",
    "วันนี้อากาศดีมาก",
    "ขอให้เป็นวันที่ดี",
    "สำหรับทุกคน"
];

const REAL_SIMULATION_LINES = REAL_SIM_LINES;

let realSimState = {
    active: false,
    currentLineIndex: 0,
    autoTimer: null,
    stepTimer: null,
    isPaused: false
};

/**
 * Initializes 3D Presentation Overlay HUD controls on top of WebGL Viewport.
 */
function ensure3DPresentationHUD() {
    if (document.getElementById('realSim3DHud')) return;

    const hudHtml = `
    <div id="realSim3DHud" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:9000; flex-direction:column; justify-content:space-between; padding:24px; box-sizing:border-box;">
        
        <!-- Top Presentation Banner -->
        <div style="pointer-events:auto; background:rgba(18, 24, 36, 0.85); border:1px solid rgba(0, 242, 254, 0.4); border-radius:12px; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; backdrop-filter:blur(12px); box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:12px; height:12px; border-radius:50%; background:#00f2fe; box-shadow:0 0 10px #00f2fe;" class="fa-beat"></div>
                <div>
                    <div style="font-size:16px; font-weight:700; color:#00f2fe; font-family:'Prompt', sans-serif;">🎬 3D REAL-WORLD PRESENTATION SIMULATION</div>
                    <div style="font-size:12px; color:#94a3b8;" id="realSimSubtext">จำลองการสแกนด้วยกล้องบนตัวเครื่อง 3D และการนูนหมุดเบรลล์ 84 พินจริง</div>
                </div>
            </div>

            <!-- Speech Toast Indicator -->
            <div id="realSimVoiceToast" style="background:rgba(0,0,0,0.6); border:1px solid #38bdf8; border-radius:20px; padding:6px 16px; font-size:13px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-volume-high fa-beat"></i>
                <span id="realSimVoiceMsg">กำลังเตรียมความพร้อมฉาก 3D...</span>
            </div>

            <button onclick="stop3DPresentationSimulation()" style="background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#ef4444; padding:8px 16px; border-radius:8px; font-weight:600; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i> ปิดโหมดนำเสนอ 3D
            </button>
        </div>

        <!-- Bottom Control Bar (Paging & 84 Pins Telemetry) -->
        <div style="pointer-events:auto; align-self:center; width:90%; max-width:850px; background:rgba(18, 24, 36, 0.9); border:1px solid rgba(0, 242, 254, 0.3); border-radius:16px; padding:18px 28px; display:flex; flex-direction:column; gap:12px; backdrop-filter:blur(16px); box-shadow:0 12px 40px rgba(0,0,0,0.6);">
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-braille" style="font-size:20px; color:#00f2fe;"></i>
                    <span style="font-size:15px; font-weight:600; color:#f8fafc; font-family:'Prompt', sans-serif;">
                        ข้อความที่แปลได้: <span id="realSimCurrentText" style="color:#00f2fe; font-weight:700;">"สวัสดีครับ"</span>
                    </span>
                </div>
                <div id="realSimBadge" style="font-family:'JetBrains Mono', monospace; font-size:13px; font-weight:700; background:rgba(0,242,254,0.2); color:#00f2fe; padding:6px 14px; border-radius:20px; border:1px solid #00f2fe;">
                    LINE 1 / 4
                </div>
            </div>

            <!-- Interactive Next / Back Control Buttons -->
            <div style="display:flex; gap:14px; align-items:center;">
                <button onclick="step3DSimLine(-1)" style="flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:10px 16px; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px;">
                    <i class="fa-solid fa-backward-step"></i> ◄ BACK (บรรทัดก่อนหน้า)
                </button>

                <button id="realSimPauseBtn" onclick="togglePause3DSim()" style="background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#f59e0b; padding:10px 20px; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px;">
                    <i class="fa-solid fa-pause"></i> หยุดชั่วคราว
                </button>
                
                <button onclick="step3DSimLine(1)" style="flex:1; background:linear-gradient(135deg, #00f2fe, #4facfe); border:none; color:#0f172a; font-weight:700; padding:10px 16px; border-radius:8px; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px; box-shadow:0 0 15px rgba(0,242,254,0.4);">
                    NEXT (บรรทัดถัดไป) ► <i class="fa-solid fa-forward-step"></i>
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', hudHtml);
}

/**
 * Starts the 3D Real-World Presentation Simulation.
 */
function startRealSimulation() {
    ensure3DPresentationHUD();

    realSimState.active = true;
    realSimState.currentLineIndex = 0;
    realSimState.isPaused = false;

    // Show 3D HUD
    const hud = document.getElementById('realSim3DHud');
    if (hud) hud.style.display = 'flex';

    // Enter 3D Camera Presentation mode in Three.js
    if (typeof setCameraView === 'function') {
        setCameraView('3d');
    }

    if (typeof controls !== 'undefined' && controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.5;
    }

    run3DSimSequence();
}

/**
 * Executes the 3D Scanning and Voice Guidance sequence step-by-step.
 */
function run3DSimSequence() {
    const voiceMsg = document.getElementById('realSimVoiceMsg');
    const subtext = document.getElementById('realSimSubtext');

    // Step 1: Scan right (0s - 1.5s)
    if (voiceMsg) voiceMsg.textContent = '🔊 ขยับกล้องไปทางขวา...';
    if (subtext) subtext.textContent = 'กำลังสแกนหาตำแหน่งข้อความบนหนังสือในฉาก 3D';
    if (typeof speakVoiceGuidance === 'function') speakVoiceGuidance('ขยับกล้องไปทางขวา', true);
    if (typeof drawScreenContent === 'function') drawScreenContent('📷 SCANNING RIGHT...');

    // Step 2: Zoom in (1.5s - 3.0s)
    realSimState.stepTimer = setTimeout(() => {
        if (!realSimState.active) return;
        if (voiceMsg) voiceMsg.textContent = '🔊 ขยับเข้าใกล้อีกนิด...';
        if (typeof speakVoiceGuidance === 'function') speakVoiceGuidance('ขยับเข้าใกล้อีกนิด', true);
        if (typeof drawScreenContent === 'function') drawScreenContent('🎯 ALIGNING 4 CORNERS');
    }, 1500);

    // Step 3: Target locked & Auto capture (3.0s - 4.5s)
    realSimState.stepTimer = setTimeout(() => {
        if (!realSimState.active) return;
        if (voiceMsg) voiceMsg.textContent = '🔊 เข้ามุมทั้ง 4 เรียบร้อยแล้ว กำลังถ่ายภาพ...';
        if (typeof speakVoiceGuidance === 'function') speakVoiceGuidance('เข้ามุมทั้ง 4 เรียบร้อยแล้ว ถือค้างไว้นะครับ', true);
        if (typeof playTacticalBeep === 'function') playTacticalBeep(1050, 220);
        if (typeof drawScreenContent === 'function') drawScreenContent('📷 AUTO CAPTURED!');
    }, 3000);

    // Step 4: OCR Translation & Actuate 84 Pins in 3D (4.5s)
    realSimState.stepTimer = setTimeout(() => {
        if (!realSimState.active) return;
        if (voiceMsg) voiceMsg.textContent = '✅ สแกนสำเร็จ! กำลังยกพินเบรลล์ 84 หมุดบนตัวเครื่อง 3D...';
        apply3DSimLine(0);
    }, 4500);
}

/**
 * Applies current line text to 3D Scene (updating OLED display and 84 Braille pin meshes).
 */
function apply3DSimLine(index) {
    if (index < 0) index = 0;
    if (index >= REAL_SIM_LINES.length) index = REAL_SIM_LINES.length - 1;

    realSimState.currentLineIndex = index;
    const text = REAL_SIM_LINES[index];

    // Update HUD text & badge
    const curTextEl = document.getElementById('realSimCurrentText');
    const badgeEl = document.getElementById('realSimBadge');
    if (curTextEl) curTextEl.textContent = `"${text}"`;
    if (badgeEl) badgeEl.textContent = `LINE ${index + 1} / ${REAL_SIM_LINES.length}`;

    // Update main app text input & trigger 84-Pin 3D Actuation
    const thaiInput = document.getElementById('thaiInput');
    if (thaiInput) {
        thaiInput.value = text;
        if (typeof updateBrailleDisplay === 'function') updateBrailleDisplay(text);
        if (typeof processTranslation === 'function') processTranslation();
    }

    // Update 3D screen texture
    if (typeof drawScreenContent === 'function') {
        drawScreenContent(`LINE ${index + 1}: ${text}`);
    }

    // Voice announcement
    if (typeof speakVoiceGuidance === 'function') {
        speakVoiceGuidance(`บรรทัดที่ ${index + 1}: ${text}`, true);
    }
}

/**
 * Steps to previous or next simulation line (Next / Back).
 */
function step3DSimLine(delta) {
    const nextIdx = realSimState.currentLineIndex + delta;
    apply3DSimLine(nextIdx);
}

/**
 * Toggles auto-play pause/resume.
 */
function togglePause3DSim() {
    realSimState.isPaused = !realSimState.isPaused;
    const btn = document.getElementById('realSimPauseBtn');
    if (btn) {
        if (realSimState.isPaused) {
            btn.innerHTML = '<i class="fa-solid fa-play"></i> เล่นต่อ';
            btn.style.background = 'rgba(16, 185, 129, 0.2)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#10b981';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-pause"></i> หยุดชั่วคราว';
            btn.style.background = 'rgba(245,158,11,0.2)';
            btn.style.borderColor = '#f59e0b';
            btn.style.color = '#f59e0b';
        }
    }
}

/**
 * Stops 3D Presentation Simulation and resets camera.
 */
function stop3DPresentationSimulation() {
    realSimState.active = false;
    if (realSimState.stepTimer) clearTimeout(realSimState.stepTimer);
    if (realSimState.autoTimer) clearTimeout(realSimState.autoTimer);

    const hud = document.getElementById('realSim3DHud');
    if (hud) hud.style.display = 'none';

    if (typeof controls !== 'undefined' && controls) {
        controls.autoRotate = false;
    }

    if (typeof resetCamera === 'function') {
        resetCamera();
    }
}

function closeRealSimulation() {
    stop3DPresentationSimulation();
}

function stepSimLine(delta) {
    step3DSimLine(delta);
}

// Global functions
window.startRealSimulation = startRealSimulation;
window.stop3DPresentationSimulation = stop3DPresentationSimulation;
window.closeRealSimulation = closeRealSimulation;
window.stepSimLine = stepSimLine;
window.step3DSimLine = step3DSimLine;
window.togglePause3DSim = togglePause3DSim;
