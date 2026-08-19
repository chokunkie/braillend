/* =========================================================================
   BraillLens 3D & Optical OCR System - Voice Guidance & 4-Corner Target Lock
   Version: 3.3.0 (4-Corner Target Lock & Assistive Auto-Shutter Core)
   ========================================================================= */

// Voice Guidance, 4-Corner Target Lock & Auto-Capture State Variables
let isVoiceGuidanceEnabled = true;
let isAutoCaptureEnabled = true;
let voiceAnalysisTimer = null;
let lastSpokenText = '';
let lastSpokenTime = 0;
let stabilityStartTime = null;
let hasSpokenPreCaptureWarning = false;
let isAutoCapturing = false;
let prevAnalysisFrame = null;
let isAnalysisRunning = false;

// Audio & Speech Constants
const SPEECH_THROTTLE_MS = 2500;          // Minimum delay between speech utterances
const STABILITY_REQUIRED_MS = 1000;       // 1.0 second stability required for auto-capture
const PRE_CAPTURE_WARNING_MS = 500;       // 0.5s pre-capture warning before shutter trigger
const MOTION_DIFF_THRESHOLD = 24.0;       // Frame difference threshold for camera motion
const CORNER_STROKE_THRESHOLD = 0.012;    // Minimum edge density in target corner zone
const MIN_TOTAL_STROKES = 35;             // Minimum strokes to confirm document presence
const ANALYSIS_INTERVAL_MS = 300;         // Live stream analysis cadence (300ms)
const FOCUS_BLURRY_THRESHOLD = 80;        // Score < 80: BLURRY
const FOCUS_SHARP_THRESHOLD = 160;        // Score >= 160: SHARP 100%

/**
 * Calculates Laplacian Variance Focus Score using 3x3 Laplacian Kernel:
 * Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
 * Score < 80: BLURRY
 * Score >= 160: SHARP 100%
 */
function calculateLaplacianFocusScore(imageData) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
        return 0;
    }
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    if (width < 3 || height < 3) return 0;

    // Convert RGBA to Grayscale Luma buffer
    const totalPixels = width * height;
    const gray = new Uint8Array(totalPixels);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 3x3 Laplacian convolution & variance calculation
    let sumLap = 0;
    let sumLapSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
        const rowOffset = y * width;
        for (let x = 1; x < width - 1; x++) {
            const center = gray[rowOffset + x];
            const top = gray[(y - 1) * width + x];
            const bottom = gray[(y + 1) * width + x];
            const left = gray[rowOffset + (x - 1)];
            const right = gray[rowOffset + (x + 1)];

            // 3x3 Laplacian Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
            const lapVal = top + bottom + left + right - (4 * center);
            sumLap += lapVal;
            sumLapSq += lapVal * lapVal;
            count++;
        }
    }

    if (count === 0) return 0;
    const mean = sumLap / count;
    const variance = (sumLapSq / count) - (mean * mean);
    return Math.max(0, Math.round(variance * 10) / 10);
}

/**
 * Updates Real-time Focus Status HUD on Camera Viewfinder Modal
 */
function updateFocusHUD(focusScore) {
    const hud = document.getElementById('focusStatusHud');
    const textEl = document.getElementById('focusStatusText');
    if (!hud || !textEl) return;

    hud.classList.remove('focus-blurry', 'focus-adjusting', 'focus-sharp');
    const roundedScore = Math.round(focusScore);

    if (focusScore < FOCUS_BLURRY_THRESHOLD) {
        hud.classList.add('focus-blurry');
        textEl.innerHTML = `<i class="fa-solid fa-circle" style="color:#FF0055; font-size:9px;"></i> [ 🔴 FOCUS: BLURRY (Score ${roundedScore}) ]`;
    } else if (focusScore < FOCUS_SHARP_THRESHOLD) {
        hud.classList.add('focus-adjusting');
        textEl.innerHTML = `<i class="fa-solid fa-circle" style="color:#F59E0B; font-size:9px;"></i> [ 🟡 FOCUS: ADJUSTING (Score ${roundedScore}) ]`;
    } else {
        hud.classList.add('focus-sharp');
        textEl.innerHTML = `<i class="fa-solid fa-circle" style="color:#00FF88; font-size:9px;"></i> [ 🟢 FOCUS: SHARP 100% (Score ${roundedScore}) ]`;
    }
}

/**
 * Synthesizes Thai voice guidance using Web Speech API (th-TH)
 */
function speakVoiceGuidance(text, force = false, onEndCallback = null) {
    if (!isVoiceGuidanceEnabled && !force) {
        if (typeof onEndCallback === 'function') onEndCallback();
        return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (typeof onEndCallback === 'function') onEndCallback();
        return;
    }

    const now = Date.now();
    if (!force && text === lastSpokenText && (now - lastSpokenTime < SPEECH_THROTTLE_MS)) {
        return;
    }
    if (!force && (now - lastSpokenTime < 1800)) {
        return;
    }

    try {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech to avoid lag

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Select Thai voice if available
        const voices = window.speechSynthesis.getVoices();
        const thVoice = voices.find(v => (v.lang && (v.lang.includes('th') || v.lang.includes('TH'))));
        if (thVoice) {
            utterance.voice = thVoice;
        }

        utterance.onend = () => {
            lastSpokenTime = Date.now();
            if (typeof onEndCallback === 'function') {
                onEndCallback();
            }
        };
        utterance.onerror = () => {
            lastSpokenTime = Date.now();
            if (typeof onEndCallback === 'function') {
                onEndCallback();
            }
        };

        window.speechSynthesis.speak(utterance);
        lastSpokenText = text;
        lastSpokenTime = now;

        updateVoiceStatusHUD(text);
    } catch (err) {
        console.warn('[VoiceGuidance SpeechSynthesis Warning]:', err);
        if (typeof onEndCallback === 'function') onEndCallback();
    }
}

/**
 * Plays tactical audio beep via Web Audio API
 */
function playTacticalBeep(frequency = 960, durationMs = 180) {
    if (typeof window === 'undefined') return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + (durationMs / 1000));
    } catch (err) {
        console.warn('[AudioContext Warning]:', err);
    }
}

/**
 * Updates Voice Guidance Status HUD in Viewfinder
 */
function updateVoiceStatusHUD(message, statusType = 'normal') {
    const hud = document.getElementById('voiceStatusHud');
    const msgEl = document.getElementById('voiceStatusMsg');
    if (!hud || !msgEl) return;

    msgEl.innerText = message;
    hud.classList.remove('status-success', 'status-warning', 'status-alert');

    if (statusType === 'success') {
        hud.classList.add('status-success');
    } else if (statusType === 'warning') {
        hud.classList.add('status-warning');
    } else if (statusType === 'alert') {
        hud.classList.add('status-alert');
    }
}

/**
 * Updates Visual 4-Corner Target Bracket HUD & Real-Time Alignment Overlay
 * Corner states: LOCKED (#00FF88 neon glow + pulse), MISSED (#FF0055), or SEARCHING
 */
function updateCornerTargetHUD(tl, tr, bl, br, hasDocument = true) {
    const corners = [
        { id: 'cornerTL', labelId: 'labelTL', name: 'TL', locked: !!tl },
        { id: 'cornerTR', labelId: 'labelTR', name: 'TR', locked: !!tr },
        { id: 'cornerBL', labelId: 'labelBL', name: 'BL', locked: !!bl },
        { id: 'cornerBR', labelId: 'labelBR', name: 'BR', locked: !!br }
    ];

    let lockedCount = 0;
    for (const c of corners) {
        const el = document.getElementById(c.id);
        const lbl = document.getElementById(c.labelId);

        if (c.locked) {
            lockedCount++;
            if (el) {
                el.classList.add('locked');
                el.classList.remove('missed');
            }
            if (lbl) lbl.innerText = `${c.name}: LOCKED`;
        } else {
            if (el) {
                el.classList.remove('locked');
                if (hasDocument) {
                    el.classList.add('missed');
                } else {
                    el.classList.remove('missed');
                }
            }
            if (lbl) {
                lbl.innerText = hasDocument ? `${c.name}: MISSED` : `${c.name}: SEARCHING`;
            }
        }
    }

    const frame = document.querySelector('.viewfinder-frame');
    if (frame) {
        frame.classList.toggle('all-locked', lockedCount === 4);
    }

    // Real-time 4-Corner Status Overlay Panel
    const overlay = document.getElementById('cornerStatusOverlay');
    const textEl = document.getElementById('cornerAlignmentText');
    const pct = Math.round((lockedCount / 4) * 100);

    if (overlay && textEl) {
        if (lockedCount === 4) {
            overlay.classList.add('locked-100');
            textEl.innerHTML = '<i class="fa-solid fa-crosshairs fa-spin"></i> [ 🎯 TARGET LOCKED 100% - AUTO CAPTURING... ]';
        } else {
            overlay.classList.remove('locked-100');
            if (hasDocument) {
                textEl.innerHTML = `<i class="fa-solid fa-bullseye"></i> 4-CORNER ALIGNMENT: ${pct}% (${lockedCount}/4 CORNERS LOCKED)`;
            } else {
                textEl.innerHTML = '<i class="fa-solid fa-camera"></i> 4-CORNER ALIGNMENT: 0% (SEARCHING DOCUMENT...)';
            }
        }
    }
}

/**
 * 4-Corner Target Detection Engine & Live Camera Vision Analysis
 * Scans for edge & stroke density in Top-Left, Top-Right, Bottom-Left, Bottom-Right target brackets
 * Evaluates Laplacian Variance Focus Score & Applies Focus Gating (Score >= 160)
 */
function analyzeLiveCameraFrame() {
    const video = document.getElementById('cameraVideo');
    if (!video || video.readyState < 2 || video.paused || video.ended) {
        return;
    }

    if (isAnalysisRunning) return;
    isAnalysisRunning = true;

    try {
        const isPortrait = (video.videoHeight || 1920) >= (video.videoWidth || 1080);
        const sampleW = isPortrait ? 120 : 160;
        const sampleH = isPortrait ? 160 : 120;

        let sampleCanvas = analyzeLiveCameraFrame._sampleCanvas;
        if (!sampleCanvas || sampleCanvas.width !== sampleW || sampleCanvas.height !== sampleH) {
            sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = sampleW;
            sampleCanvas.height = sampleH;
            analyzeLiveCameraFrame._sampleCanvas = sampleCanvas;
        }

        const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(video, 0, 0, sampleW, sampleH);

        const imgData = sctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;
        const totalPixels = sampleW * sampleH;

        // Calculate Real-Time Laplacian Focus Score & Update HUD
        const focusScore = calculateLaplacianFocusScore(imgData);
        updateFocusHUD(focusScore);

        // Grayscale conversion & Frame Difference (Camera Stability Analysis)
        let totalDiff = 0;
        const currentLuma = new Uint8Array(totalPixels);
        let minLuma = 255;
        let maxLuma = 0;

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            currentLuma[p] = luma;
            if (luma < minLuma) minLuma = luma;
            if (luma > maxLuma) maxLuma = luma;

            if (prevAnalysisFrame) {
                totalDiff += Math.abs(luma - prevAnalysisFrame[p]);
            }
        }

        const avgMotionDiff = prevAnalysisFrame ? (totalDiff / totalPixels) : 0;
        prevAnalysisFrame = currentLuma;

        const contrastRange = maxLuma - minLuma;
        const strokeThreshold = Math.max(16, contrastRange * 0.15);

        // 4 Target Corner Zones in Frame (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
        const zoneTL = { x0: Math.round(sampleW * 0.08), x1: Math.round(sampleW * 0.38), y0: Math.round(sampleH * 0.08), y1: Math.round(sampleH * 0.40) };
        const zoneTR = { x0: Math.round(sampleW * 0.62), x1: Math.round(sampleW * 0.92), y0: Math.round(sampleH * 0.08), y1: Math.round(sampleH * 0.40) };
        const zoneBL = { x0: Math.round(sampleW * 0.08), x1: Math.round(sampleW * 0.38), y0: Math.round(sampleH * 0.60), y1: Math.round(sampleH * 0.92) };
        const zoneBR = { x0: Math.round(sampleW * 0.62), x1: Math.round(sampleW * 0.92), y0: Math.round(sampleH * 0.60), y1: Math.round(sampleH * 0.92) };

        const pixelsTL = (zoneTL.x1 - zoneTL.x0) * (zoneTL.y1 - zoneTL.y0);
        const pixelsTR = (zoneTR.x1 - zoneTR.x0) * (zoneTR.y1 - zoneTR.y0);
        const pixelsBL = (zoneBL.x1 - zoneBL.x0) * (zoneBL.y1 - zoneBL.y0);
        const pixelsBR = (zoneBR.x1 - zoneBR.x0) * (zoneBR.y1 - zoneBR.y0);

        let countTL = 0, countTR = 0, countBL = 0, countBR = 0;
        let totalStrokes = 0;

        for (let y = 1; y < sampleH - 1; y++) {
            const rowOffset = y * sampleW;
            const inY_Top = (y >= zoneTL.y0 && y <= zoneTL.y1);
            const inY_Bottom = (y >= zoneBL.y0 && y <= zoneBL.y1);

            for (let x = 1; x < sampleW - 1; x++) {
                const idx = rowOffset + x;
                const gx = Math.abs(currentLuma[idx + 1] - currentLuma[idx - 1]);
                const gy = Math.abs(currentLuma[idx + sampleW] - currentLuma[idx - sampleW]);
                const strokeEnergy = gx + gy;

                if (strokeEnergy > strokeThreshold) {
                    totalStrokes++;

                    const inX_Left = (x >= zoneTL.x0 && x <= zoneTL.x1);
                    const inX_Right = (x >= zoneTR.x0 && x <= zoneTR.x1);

                    if (inY_Top && inX_Left) countTL++;
                    if (inY_Top && inX_Right) countTR++;
                    if (inY_Bottom && inX_Left) countBL++;
                    if (inY_Bottom && inX_Right) countBR++;
                }
            }
        }

        const densityTL = countTL / Math.max(1, pixelsTL);
        const densityTR = countTR / Math.max(1, pixelsTR);
        const densityBL = countBL / Math.max(1, pixelsBL);
        const densityBR = countBR / Math.max(1, pixelsBR);

        const hasDocument = (totalStrokes >= MIN_TOTAL_STROKES) && (contrastRange >= 18);

        if (!hasDocument) {
            updateCornerTargetHUD(false, false, false, false);
            updateFocusHUD(0);
            stabilityStartTime = null;
            speakVoiceGuidance('ยังไม่พบเอกสาร กรุณาส่องกล้องไปที่หนังสือ');
            updateVoiceStatusHUD('ยังไม่พบเอกสาร กรุณาส่องกล้องไปที่หนังสือ', 'alert');
            return;
        }

        // Evaluate 4-Corner Target Locks
        const lockedTL = densityTL >= CORNER_STROKE_THRESHOLD;
        const lockedTR = densityTR >= CORNER_STROKE_THRESHOLD;
        const lockedBL = densityBL >= CORNER_STROKE_THRESHOLD;
        const lockedBR = densityBR >= CORNER_STROKE_THRESHOLD;

        // Immediate Visual Feedback on Viewfinder Brackets
        updateCornerTargetHUD(lockedTL, lockedTR, lockedBL, lockedBR);

        const isCameraStable = (avgMotionDiff < MOTION_DIFF_THRESHOLD);
        const isFocusSharp = (focusScore >= FOCUS_SHARP_THRESHOLD);
        const isFocusBlurry = (focusScore < FOCUS_BLURRY_THRESHOLD);

        if (lockedTL && lockedTR && lockedBL && lockedBR) {
            // All 4 Corners Locked! Check Focus Gating
            if (isFocusBlurry) {
                // Focus Gating: Image is blurry (Score < 80) -> Prompt user to hold steady
                stabilityStartTime = null;
                hasSpokenPreCaptureWarning = false;
                speakVoiceGuidance('ภาพยังเบลออยู่ ถือกล้องนิ่งๆ อีกนิดนะครับ');
                updateVoiceStatusHUD('📷 ภาพยังเบลออยู่ ถือกล้องนิ่งๆ อีกนิดนะครับ...', 'warning');
            } else if (!isFocusSharp) {
                // Score 80..159 (Adjusting focus)
                stabilityStartTime = null;
                hasSpokenPreCaptureWarning = false;
                updateVoiceStatusHUD(`🔍 กำลังปรับความคมชัด (Score ${Math.round(focusScore)}/160)...`, 'warning');
            } else if (isCameraStable && isFocusSharp) {
                // Focus Gating PASSED (Score >= 160) + 4-Corners Locked + Camera Stable!
                if (!stabilityStartTime) {
                    stabilityStartTime = Date.now();
                    hasSpokenPreCaptureWarning = false;
                    speakVoiceGuidance('ตัวอักษรชัดเจนแล้ว ถือค้างไว้นะครับ...');
                    updateVoiceStatusHUD('🎯 ตัวอักษรชัดเจนแล้ว ถือค้างไว้นะครับ...', 'success');
                } else {
                    const elapsed = Date.now() - stabilityStartTime;
                    const remaining = Math.max(0, ((STABILITY_REQUIRED_MS - elapsed) / 1000).toFixed(1));

                    // Pre-Capture Voice Warning: 0.5s before shutter trigger
                    if (elapsed >= (STABILITY_REQUIRED_MS - PRE_CAPTURE_WARNING_MS) && !hasSpokenPreCaptureWarning) {
                        hasSpokenPreCaptureWarning = true;
                        speakVoiceGuidance('กำลังถ่ายภาพ อยู่นิ่งๆ นะครับ', true);
                        updateVoiceStatusHUD('📸 กำลังถ่ายภาพ อยู่นิ่งๆ นะครับ...', 'warning');
                    } else if (!hasSpokenPreCaptureWarning) {
                        updateVoiceStatusHUD(`🎯 เข้ามุมและชัดแล้ว ถือค้างอีก ${remaining}s...`, 'success');
                    }

                    // Focus Gating Protection: Shutter fires ONLY when focusScore >= 160 (SHARP 100%)
                    if (elapsed >= STABILITY_REQUIRED_MS && isAutoCaptureEnabled && !isAutoCapturing && focusScore >= FOCUS_SHARP_THRESHOLD) {
                        isAutoCapturing = true;
                        stabilityStartTime = null;

                        const executeShutter = () => {
                            playTacticalBeep(1050, 220);
                            speakVoiceGuidance('ถ่ายภาพสำเร็จ กำลังอ่านข้อความภาษาอังกฤษ...', true);
                            updateVoiceStatusHUD('📸 ลั่นชัตเตอร์อัตโนมัติสำเร็จ!', 'success');

                            if (typeof captureCameraSnapshot === 'function') {
                                captureCameraSnapshot();
                            }
                            isAutoCapturing = false;
                            hasSpokenPreCaptureWarning = false;
                        };

                        if (isVoiceGuidanceEnabled && typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
                            let shutterDone = false;
                            const doneCallback = () => {
                                if (!shutterDone) {
                                    shutterDone = true;
                                    executeShutter();
                                }
                            };
                            setTimeout(doneCallback, 600);
                        } else {
                            executeShutter();
                        }
                    }
                }
            } else {
                stabilityStartTime = null;
                hasSpokenPreCaptureWarning = false;
                updateVoiceStatusHUD('เข้ามุมและชัดแล้ว แต่ภาพขยับ ถือกล้องให้นิ่ง...', 'warning');
            }
        } else {
            // One or more corners are out of target bracket
            stabilityStartTime = null;
            hasSpokenPreCaptureWarning = false;

            if (!lockedTL && !lockedTR && !lockedBL && !lockedBR) {
                speakVoiceGuidance('ยังไม่เข้ามุม กรุณาขยับหนังสือให้ตรงกรอบ 4 มุม');
                updateVoiceStatusHUD('ยังไม่เข้ามุม เล็งหนังสือให้ตรงกรอบ 4 มุม', 'warning');
            } else if (!lockedTL && !lockedTR) {
                speakVoiceGuidance('มุมด้านบนหลุดกรอบ ให้เลื่อนกล้องขึ้นบน');
                updateVoiceStatusHUD('มุมด้านบนหลุดกรอบ ▲ เลื่อนกล้องขึ้นบน', 'warning');
            } else if (!lockedBL && !lockedBR) {
                speakVoiceGuidance('มุมด้านล่างหลุดกรอบ ให้เลื่อนกล้องลงล่าง');
                updateVoiceStatusHUD('มุมด้านล่างหลุดกรอบ ▼ เลื่อนกล้องลงล่าง', 'warning');
            } else if (!lockedTL && !lockedBL) {
                speakVoiceGuidance('มุมด้านซ้ายหลุดกรอบ ให้ขยับกล้องไปทางซ้าย');
                updateVoiceStatusHUD('มุมด้านซ้ายหลุดกรอบ ◄ ขยับกล้องไปทางซ้าย', 'warning');
            } else if (!lockedTR && !lockedBR) {
                speakVoiceGuidance('มุมด้านขวาหลุดกรอบ ให้ขยับกล้องไปทางขวา');
                updateVoiceStatusHUD('มุมด้านขวาหลุดกรอบ ► ขยับกล้องไปทางขวา', 'warning');
            } else if (!lockedTL) {
                speakVoiceGuidance('มุมบนซ้ายหลุดกรอบ');
                updateVoiceStatusHUD('มุมบนซ้ายหลุดกรอบ ↖', 'warning');
            } else if (!lockedTR) {
                speakVoiceGuidance('มุมบนขวาหลุดกรอบ');
                updateVoiceStatusHUD('มุมบนขวาหลุดกรอบ ↗', 'warning');
            } else if (!lockedBL) {
                speakVoiceGuidance('มุมล่างซ้ายหลุดกรอบ');
                updateVoiceStatusHUD('มุมล่างซ้ายหลุดกรอบ ↙', 'warning');
            } else if (!lockedBR) {
                speakVoiceGuidance('มุมล่างขวาหลุดกรอบ');
                updateVoiceStatusHUD('มุมล่างขวาหลุดกรอบ ↘', 'warning');
            }
        }
    } catch (err) {
        console.warn('[4-Corner Target Analyzer Error]:', err);
    } finally {
        isAnalysisRunning = false;
    }
}

/**
 * Starts 300ms Live Vision & 4-Corner Voice Guidance Loop
 */
function startLiveVoiceGuidance() {
    stopLiveVoiceGuidance();
    stabilityStartTime = null;
    hasSpokenPreCaptureWarning = false;
    isAutoCapturing = false;
    prevAnalysisFrame = null;
    lastSpokenText = '';
    lastSpokenTime = 0;
    updateCornerTargetHUD(false, false, false, false);
    updateFocusHUD(0);

    if (isVoiceGuidanceEnabled) {
        speakVoiceGuidance('เปิดกล้องแล้ว เล็งเอกสารให้ตรงกับกรอบ 4 มุม...');
    }

    voiceAnalysisTimer = setInterval(analyzeLiveCameraFrame, ANALYSIS_INTERVAL_MS);
}

/**
 * Stops Live Vision & 4-Corner Voice Guidance Loop
 */
function stopLiveVoiceGuidance() {
    if (voiceAnalysisTimer) {
        clearInterval(voiceAnalysisTimer);
        voiceAnalysisTimer = null;
    }
    stabilityStartTime = null;
    hasSpokenPreCaptureWarning = false;
    isAutoCapturing = false;
    prevAnalysisFrame = null;
    updateCornerTargetHUD(false, false, false, false);
    updateFocusHUD(0);
    if (typeof window !== 'undefined' && ('speechSynthesis' in window)) {
        window.speechSynthesis.cancel();
    }
}

/**
 * Toggles Voice Guidance ON / OFF
 */
function toggleVoiceGuidance(forcedState = null) {
    if (typeof forcedState === 'boolean') {
        isVoiceGuidanceEnabled = forcedState;
    } else {
        isVoiceGuidanceEnabled = !isVoiceGuidanceEnabled;
    }

    const btn = document.getElementById('btnToggleVoiceGuidance');
    const textEl = document.getElementById('voiceGuidanceText');

    if (btn) {
        if (isVoiceGuidanceEnabled) {
            btn.classList.add('active');
            if (textEl) textEl.innerText = 'Voice: ON';
        } else {
            btn.classList.remove('active');
            if (textEl) textEl.innerText = 'Voice: OFF';
            if (typeof window !== 'undefined' && ('speechSynthesis' in window)) {
                window.speechSynthesis.cancel();
            }
        }
    }

    if (isVoiceGuidanceEnabled) {
        speakVoiceGuidance('เปิดระบบเสียงแนะนำแล้ว', true);
    }
    return isVoiceGuidanceEnabled;
}

/**
 * Toggles Auto-Capture ON / OFF
 */
function toggleAutoCapture(forcedState = null) {
    if (typeof forcedState === 'boolean') {
        isAutoCaptureEnabled = forcedState;
    } else {
        isAutoCaptureEnabled = !isAutoCaptureEnabled;
    }

    const btn = document.getElementById('btnToggleAutoCapture');
    const textEl = document.getElementById('autoCaptureText');

    if (btn) {
        if (isAutoCaptureEnabled) {
            btn.classList.add('active');
            if (textEl) textEl.innerText = 'Auto-Capture: ON';
        } else {
            btn.classList.remove('active');
            if (textEl) textEl.innerText = 'Auto-Capture: OFF';
        }
    }

    if (isVoiceGuidanceEnabled) {
        speakVoiceGuidance(isAutoCaptureEnabled ? 'เปิดระบบถ่ายภาพอัตโนมัติ' : 'ปิดระบบถ่ายภาพอัตโนมัติ', true);
    }
    return isAutoCaptureEnabled;
}
