/* =========================================================================
   BraillLens 3D & Optical OCR System - Three.js 3D Hardware Simulation Scene
   Version: 3.1.0 (Modular 3D Hardware Core)
   ========================================================================= */

// Three.js Core State Variables
let scene, camera, renderer, controls;
let chassisMesh, plateMesh, chassisMaterialGlass, chassisMaterialSolid;
let screenCanvas, ctx, screenCtx, screenTexture, screenMesh;
let oledCanvas, oledCtx, oledTexture, oledMesh;
let ledDataMesh, ledPwrMesh, ledFlashMesh;
let pcbMesh, internalGroup;
let tftPcbMesh, bezelRim, oledGlass, rearGroup;
let ledFront, ledBack, dividerMesh, stripeMesh, pwrRing;
let ambientLightRef;
let isXRay = false;
let isPresenting = false;
let presentInterval = null;
let isLightMode = false;

// Exploded View State Variables
let isExploded = false;
let explodedLayers = [];
let explodedProgress = 0;
let explodedAnimFrom = 0;
let explodedAnimTo = 0;
let explodedAnimStart = 0;
let explodedAnimDuration = 1000;
let explodedAmount = 1.0;
let explodedLabelsVisible = false;
let explodedLabelsLayerEl = null;
let explodedLinesSvg = null;

// Global Actuation Arrays (14 cells * 6 pins = 84 pins total)
const pinTargetY = new Array(84).fill(0.0);
const pinTargetCamAngle = new Array(84).fill(0.0);
const cellGroups = [];
const pinMeshes = [];
const currentActiveState = Array(14).fill(0).map(() => Array(6).fill(false));

// Dynamic LCD Smart Display Variables
let currentLCDText = 'HELLO WORLD';
let pulseAnimFrame = 0;

// 3D Tactical Hardware Buttons State Variables
let btn3DPrevGroup, btn3DPrev, btn3DPrevCanvas, btn3DPrevTexture, btn3DPrevMat;
let btn3DNextGroup, btn3DNext, btn3DNextCanvas, btn3DNextTexture, btn3DNextMat;
let btn3DModeGroup, btn3DMode, btn3DModeCanvas, btn3DModeTexture, btn3DModeMat;
let hoveredInteractiveType = null;
const btnPressOffsets = { prev: 0, next: 0, mode: 0 };
const btnBaseYs = { prev: 0.05, next: 0.05, mode: 0.05 };

/**
 * Utility: Draws rounded rectangle onto Canvas 2D context
 */
function drawRoundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth || 1;
        ctx.stroke();
    }
}

/**
 * Initializes Virtual OLED / LCD Canvas Texture
 */
function initScreenDisplay() {
    screenCanvas = document.createElement('canvas');
    screenCanvas.width = 1024;
    screenCanvas.height = 512;
    ctx = screenCanvas.getContext('2d');
    screenCtx = ctx;

    screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.minFilter = THREE.LinearFilter;
    screenTexture.magFilter = THREE.LinearFilter;

    oledCanvas = screenCanvas;
    oledCtx = ctx;
    oledTexture = screenTexture;

    drawScreenContent('HELLO WORLD');
    if (screenTexture) screenTexture.needsUpdate = true;
    if (oledTexture) oledTexture.needsUpdate = true;
}

function initOLEDDisplay() {
    initScreenDisplay();
}

function drawScreenTexture(text) {
    drawScreenContent(text);
}

function updateOLEDDisplay(text) {
    drawScreenContent(text);
}

function updateLCDDisplay(text) {
    drawScreenContent(text);
}

function updateScreenCanvas(text) {
    drawScreenContent(text);
}

/**
 * Renders full tactical HUD readout onto OLED Canvas Texture
 */
function drawScreenContent(text) {
    if (!ctx && screenCtx) ctx = screenCtx;
    if (!ctx) return;
    if (text !== undefined && text !== null) {
        currentLCDText = text;
        if (typeof currentText !== 'undefined') currentText = text;
    }
    const displayStr = (currentLCDText && currentLCDText.trim() !== '') ? currentLCDText : 'HELLO WORLD';
    pulseAnimFrame += 0.08;

    let activePinCount = 0;
    for (let i = 0; i < pinTargetY.length; i++) {
        if (pinTargetY[i] > 0.04) activePinCount++;
    }

    const w = 1024;
    const h = 512;
    ctx.save();

    // 1. Background
    ctx.fillStyle = '#0b132b';
    ctx.fillRect(0, 0, w, h);

    // Tech Grid Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Outer Rim
    drawRoundRect(ctx, 4, 4, w - 8, h - 8, 14, null, '#00f0ff', 2);
    drawRoundRect(ctx, 8, 8, w - 16, h - 16, 10, null, 'rgba(255, 255, 255, 0.12)', 1);

    // 2. Header Bar
    const headY = 16, headH = 52;
    drawRoundRect(ctx, 16, headY, w - 32, headH, 8, 'rgba(19, 30, 58, 0.95)', '#00f0ff', 1.5);
    ctx.font = "bold 32px Prompt, sans-serif";
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillText('Waveshare 3.5" TFT LCD • Raspberry Pi Zero 2 W', 32, headY + 36);
    ctx.shadowBlur = 0;

    // 3. Telemetry Bar
    const telemY = 78, telemH = 44;
    drawRoundRect(ctx, 16, telemY, w - 32, telemH, 8, 'rgba(0, 255, 136, 0.08)', '#00ff88', 1.5);
    const totalPages = (typeof currentBrailleChunks !== 'undefined' && currentBrailleChunks && currentBrailleChunks.length > 0) ? currentBrailleChunks.length : 1;
    const currentPage = (typeof currentBraillePageIndex !== 'undefined') ? currentBraillePageIndex + 1 : 1;
    const langLabel = (typeof currentLanguageMode !== 'undefined' && currentLanguageMode === 'eng') ? 'ENG' : 'THAI';

    ctx.font = "bold 26px Prompt, sans-serif";
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillText(`● CPU: 18% | TEMP: 42°C | 5G ONLINE | MODE: ${langLabel} | PAGE ${currentPage}/${totalPages}`, 32, telemY + 31);
    ctx.shadowBlur = 0;

    // 4. Main Text Box
    const boxX = 16, boxY = 132, boxW = w - 32, boxH = 244;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 12, '#131e3a', '#00f0ff', 2.5);
    ctx.shadowBlur = 0;

    const totalChars = (typeof currentBrailleFullText !== 'undefined' && currentBrailleFullText) ? Array.from(currentBrailleFullText).length : Array.from(displayStr).length;
    const startCharIdx = totalChars === 0 ? 0 : (currentPage - 1) * 14 + 1;
    const endCharIdx = totalChars === 0 ? 0 : Math.min(currentPage * 14, totalChars);
    const rangeStr = totalPages > 1 ? ` • PAGE ${currentPage}/${totalPages} [${startCharIdx}-${endCharIdx}]` : '';

    ctx.font = "bold 18px 'JetBrains Mono', Prompt, monospace";
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.fillText(`📷 LIVE SCAN & BRAILLE INPUT READOUT (${langLabel}${rangeStr})`, boxX + 18, boxY + 26);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let gy = boxY + 38; gy < boxY + boxH - 10; gy += 10) {
        ctx.beginPath(); ctx.moveTo(boxX + 10, gy); ctx.lineTo(boxX + boxW - 10, gy); ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 18;

    let textToDraw = displayStr;
    let fontSize = 64;
    if (textToDraw.length > 10) fontSize = 54;
    if (textToDraw.length > 16) fontSize = 44;
    if (textToDraw.length > 22) fontSize = 36;
    if (textToDraw.length > 30) {
        textToDraw = textToDraw.substring(0, 28) + '...';
        fontSize = 32;
    }
    ctx.font = `bold ${fontSize}px Prompt, sans-serif`;
    ctx.fillText(textToDraw, w / 2, boxY + boxH / 2 + 10);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 5. Badges
    const badgeY = 388, badgeH = 46, badge1W = 270;
    drawRoundRect(ctx, 16, badgeY, badge1W, badgeH, 8, '#ff6b00', '#ff6b00', 1);
    ctx.font = "bold 22px Prompt, sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`⚡ BRAILLE [PG ${currentPage}/${totalPages}]`, 30, badgeY + 31);

    const displayPinText = (activePinCount > 0) ? `${activePinCount} PINS ACTIVE` : '84 PINS ACTIVE';
    const badge2W = 240;
    drawRoundRect(ctx, 16 + badge1W + 12, badgeY, badge2W, badgeH, 8, '#2563eb', '#2563eb', 1);
    ctx.font = "bold 22px Prompt, sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`📍 ${displayPinText}`, 16 + badge1W + 26, badgeY + 31);

    // 6. Cyan-Green Pulse Wave
    const waveX = 16 + badge1W + 12 + badge2W + 12;
    const waveW = w - waveX - 16, waveY = 388, waveH = 108;
    drawRoundRect(ctx, waveX, waveY, waveW, waveH, 10, 'rgba(19, 30, 58, 0.95)', '#00f0ff', 1.5);
    ctx.font = "bold 15px 'JetBrains Mono', Prompt, monospace";
    ctx.fillStyle = '#00ff88';
    ctx.fillText('SIGNAL PULSE WAVE', waveX + 12, waveY + 22);

    ctx.save();
    ctx.beginPath();
    ctx.rect(waveX + 4, waveY + 26, waveW - 8, waveH - 30);
    ctx.clip();

    const waveGrad = ctx.createLinearGradient(waveX, 0, waveX + waveW, 0);
    waveGrad.addColorStop(0, '#00f0ff');
    waveGrad.addColorStop(0.5, '#00ff88');
    waveGrad.addColorStop(1, '#00ff88');

    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    const midY = waveY + 26 + (waveH - 30) / 2;
    const activeBoost = (activePinCount > 0) ? 1.5 : 1.0;
    for (let x = 0; x < waveW; x += 3) {
        const sampleX = x + pulseAnimFrame * 24;
        let sinVal = Math.sin(sampleX * 0.05) * 6 * activeBoost;
        const pulsePeriod = (sampleX % 115);
        if (pulsePeriod > 35 && pulsePeriod < 45) sinVal -= 18 * activeBoost;
        else if (pulsePeriod >= 45 && pulsePeriod < 60) sinVal += 22 * activeBoost;
        else if (pulsePeriod >= 60 && pulsePeriod < 70) sinVal -= 12 * activeBoost;
        const drawY = midY + sinVal;
        if (x === 0) ctx.moveTo(waveX + x, drawY);
        else ctx.lineTo(waveX + x, drawY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();

    if (screenTexture) screenTexture.needsUpdate = true;
    if (oledTexture) oledTexture.needsUpdate = true;
}

/**
 * Tactical Data LED Flash
 */
function flashDataLED() {
    if (ledDataMesh) {
        ledDataMesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (ledDataMesh) {
                const cyanHex = isLightMode ? 0x0891B2 : 0x00F0FF;
                ledDataMesh.material.color.setHex(cyanHex);
            }
        }, 150);
    }
}

/**
 * Initializes Main Three.js Scene, Camera, Lights, and Meshes
 */
function initMain3D() {
    const container = document.getElementById('webgl-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    initOLEDDisplay();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a13);

    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 13, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, -0.5);

    // Lighting
    ambientLightRef = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLightRef);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(10, 15, 10);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.45);
    dirLight2.position.set(-10, 8, -10);
    scene.add(dirLight2);

    const topLight = new THREE.PointLight(0x00ff88, 0.5, 20);
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    createHardwareChassis();
    createBrailleCells();
    createTactical3DButtons();
    setupExplodedLayers();

    window.addEventListener('resize', onWindowResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function getIntersectedTarget(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length === 0) return null;

        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while (obj && obj !== scene) {
                if (obj.userData && obj.userData.interactiveType) {
                    return { type: 'button', interactiveType: obj.userData.interactiveType, obj: obj };
                }
                if (obj.userData && (obj.userData.cellIdx !== undefined || obj.userData.cellIdx === 0)) {
                    return { type: 'cell', cellIdx: obj.userData.cellIdx, obj: obj };
                }
                obj = obj.parent;
            }
        }
        return null;
    }

    renderer.domElement.addEventListener('mousemove', (e) => {
        const target = getIntersectedTarget(e);
        const nextHoveredType = (target && target.type === 'button') ? target.interactiveType : null;

        if (nextHoveredType !== hoveredInteractiveType) {
            hoveredInteractiveType = nextHoveredType;
            update3DButtonsState();

            if (btn3DPrevMat) btn3DPrevMat.emissiveIntensity = (hoveredInteractiveType === 'prev') ? 0.6 : 0.15;
            if (btn3DNextMat) btn3DNextMat.emissiveIntensity = (hoveredInteractiveType === 'next') ? 0.6 : 0.15;
            if (btn3DModeMat) btn3DModeMat.emissiveIntensity = (hoveredInteractiveType === 'mode') ? 0.6 : 0.15;
        }

        if (target) {
            renderer.domElement.style.cursor = 'pointer';
        } else {
            renderer.domElement.style.cursor = 'default';
        }
    });

    renderer.domElement.addEventListener('click', (e) => {
        const target = getIntersectedTarget(e);
        if (!target) return;

        if (target.type === 'button') {
            press3DButton(target.interactiveType);
            if (target.interactiveType === 'prev' && typeof prevBraillePage === 'function') {
                prevBraillePage();
            } else if (target.interactiveType === 'next' && typeof nextBraillePage === 'function') {
                nextBraillePage();
            } else if (target.interactiveType === 'mode' && typeof toggleLanguageMode === 'function') {
                toggleLanguageMode();
            } else if (target.interactiveType === 'power' && typeof togglePresentation === 'function') {
                togglePresentation();
            }
        } else if (target.type === 'cell' && typeof selectCellCard === 'function') {
            selectCellCard(target.cellIdx);
        }
    });

    animate();
}

/**
 * Builds Hardware Chassis, PCB, Display module, and Camera assembly
 */
function createHardwareChassis() {
    const chassisGeo = new THREE.BoxGeometry(14.5, 1.2, 9.5);
    chassisMaterialSolid = new THREE.MeshStandardMaterial({ color: 0x121826, metalness: 0.85, roughness: 0.25 });
    chassisMaterialGlass = new THREE.MeshPhysicalMaterial({
        color: 0x00f0ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, transmission: 0.85, thickness: 0.6
    });

    chassisMesh = new THREE.Mesh(chassisGeo, chassisMaterialSolid);
    chassisMesh.position.set(0, -0.6, 0);
    chassisMesh.receiveShadow = true;
    chassisMesh.castShadow = true;
    scene.add(chassisMesh);

    const plateGeo = new THREE.BoxGeometry(14.1, 0.04, 9.1);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.9, roughness: 0.2 });
    plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, -0.02, 0);
    scene.add(plateMesh);

    const ledGeo = new THREE.BoxGeometry(14.3, 0.04, 0.04);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    ledFront = new THREE.Mesh(ledGeo, ledMat);
    ledFront.position.set(0, -0.05, 4.72);
    scene.add(ledFront);

    ledBack = new THREE.Mesh(ledGeo, ledMat);
    ledBack.position.set(0, -0.05, -4.72);
    scene.add(ledBack);

    const dividerGeo = new THREE.BoxGeometry(14.1, 0.06, 0.3);
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15, emissive: 0x00f0ff, emissiveIntensity: 0.15 });
    dividerMesh = new THREE.Mesh(dividerGeo, dividerMat);
    dividerMesh.position.set(0, 0.01, -0.5);
    scene.add(dividerMesh);

    const stripeGeo = new THREE.BoxGeometry(13.8, 0.01, 0.05);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.set(0, 0.041, -0.5);
    scene.add(stripeMesh);

    // Internal PCB Group
    internalGroup = new THREE.Group();
    const pcbGeo = new THREE.BoxGeometry(14.0, 0.04, 9.0);
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x044a29, metalness: 0.3, roughness: 0.3 });
    pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.position.set(0, -0.95, 0);
    internalGroup.add(pcbMesh);

    for (let t = -6.5; t <= 6.5; t += 0.5) {
        const trace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 8.8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 }));
        trace.position.set(t, -0.925, 0);
        internalGroup.add(trace);
    }
    for (let z = -4.0; z <= 4.0; z += 0.8) {
        const trace = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.005, 0.04), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 }));
        trace.position.set(0, -0.925, z);
        internalGroup.add(trace);
    }

    const rpiMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 1.8), new THREE.MeshStandardMaterial({ color: 0x054f2a, roughness: 0.3, metalness: 0.2 }));
    rpiMesh.position.set(-4.2, -0.9, -2.6);
    internalGroup.add(rpiMesh);

    const socMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.75), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 }));
    socMesh.position.set(-4.5, -0.85, -2.6);
    internalGroup.add(socMesh);

    for (let pinX = -1.6; pinX <= 1.6; pinX += 0.16) {
        for (let pinZ = -0.15; pinZ <= 0.15; pinZ += 0.3) {
            const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 }));
            pin.position.set(-4.2 + pinX, -0.8, -3.3 + pinZ);
            internalGroup.add(pin);
        }
    }

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 1.4), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5, metalness: 0.3 }));
    ribbon.position.set(-2.2, -0.45, -2.6);
    ribbon.rotation.z = -Math.PI / 12;
    internalGroup.add(ribbon);

    for (let c = 0; c < 14; c++) {
        const cellX = -6.1 + c * 0.94;
        const drv = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
        drv.position.set(cellX, -0.89, 0.3);
        internalGroup.add(drv);

        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.9), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }));
        rib.position.set(cellX, -0.85, 0.85);
        internalGroup.add(rib);
    }
    scene.add(internalGroup);

    // TFT LCD Display Module (Z = -2.6)
    tftPcbMesh = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 3.2), new THREE.MeshStandardMaterial({ color: 0x0f141d, metalness: 0.6, roughness: 0.3 }));
    tftPcbMesh.position.set(0, 0.78, -2.6);
    scene.add(tftPcbMesh);

    bezelRim = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.02, 3.2), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 }));
    bezelRim.position.set(0, 0.81, -2.6);
    scene.add(bezelRim);

    screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.0), new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide }));
    screenMesh.rotation.x = -Math.PI / 2;
    screenMesh.position.set(0, 0.82, -2.6);
    scene.add(screenMesh);
    oledMesh = screenMesh;

    oledGlass = new THREE.Mesh(new THREE.PlaneGeometry(6.45, 3.05), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, transmission: 0.95 }));
    oledGlass.rotation.x = -Math.PI / 2;
    oledGlass.position.set(0, 0.825, -2.6);
    scene.add(oledGlass);

    const pwrBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 32), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    pwrBezel.position.set(5.2, 0.81, -2.6);
    pwrBezel.userData = { interactiveType: 'power' };
    scene.add(pwrBezel);

    pwrRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    pwrRing.rotation.x = Math.PI / 2;
    pwrRing.position.set(5.2, 0.845, -2.6);
    pwrRing.userData = { interactiveType: 'power' };
    scene.add(pwrRing);

    const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 }));
    pwrBtn.position.set(5.2, 0.84, -2.6);
    pwrBtn.userData = { interactiveType: 'power' };
    scene.add(pwrBtn);

    const ledBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 1.7), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }));
    ledBlock.position.set(-5.2, 0.80, -2.6);
    scene.add(ledBlock);

    ledPwrMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    ledPwrMesh.position.set(-5.2, 0.82, -3.1);
    scene.add(ledPwrMesh);

    ledDataMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    ledDataMesh.position.set(-5.2, 0.82, -2.6);
    scene.add(ledDataMesh);

    ledFlashMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xffb800 }));
    ledFlashMesh.position.set(-5.2, 0.82, -2.1);
    scene.add(ledFlashMesh);

    // Rear Camera Assembly
    rearGroup = new THREE.Group();
    rearGroup.position.set(0, -1.2, -2.6);
    const camIsland = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 2.2), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 }));
    camIsland.position.set(0, -0.04, 0);
    rearGroup.add(camIsland);

    const lensOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.15 }));
    lensOuter.position.set(-1.1, -0.09, 0);
    rearGroup.add(lensOuter);

    const lensGlass = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhysicalMaterial({ color: 0x001133, transmission: 0.88, opacity: 0.9, transparent: true, roughness: 0.05 }));
    lensGlass.rotation.x = Math.PI;
    lensGlass.position.set(-1.1, -0.12, 0);
    rearGroup.add(lensGlass);
    scene.add(rearGroup);
}

/**
 * Renders high-contrast cyberpunk graphics onto 3D button canvas textures
 */
function drawButtonCanvas(canvas, type) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const isHovered = (hoveredInteractiveType === type);
    const isEng = (typeof currentLanguageMode !== 'undefined' && currentLanguageMode === 'eng');
    const totalPages = (typeof currentBrailleChunks !== 'undefined' && currentBrailleChunks && currentBrailleChunks.length > 0) ? currentBrailleChunks.length : 1;
    const curPage = (typeof currentBraillePageIndex !== 'undefined') ? currentBraillePageIndex + 1 : 1;
    const isPrevDisabled = (curPage <= 1);
    const isNextDisabled = (curPage >= totalPages);

    // 1. Button Base Background
    const bgFill = isHovered ? '#1e293b' : (isLightMode ? '#ffffff' : '#0f172a');
    drawRoundRect(ctx, 4, 4, w - 8, h - 8, 14, bgFill, null, 0);

    // 2. Tactical Border & Labeling
    if (type === 'prev') {
        const strokeColor = isPrevDisabled ? (isLightMode ? '#cbd5e1' : '#334155') : (isHovered ? '#38bdf8' : (isLightMode ? '#0891b2' : '#00f0ff'));
        const textColor = isPrevDisabled ? (isLightMode ? '#94a3b8' : '#475569') : (isLightMode ? '#0f172a' : '#ffffff');
        const subColor = isPrevDisabled ? (isLightMode ? '#cbd5e1' : '#334155') : (isLightMode ? '#0891b2' : '#00f0ff');

        drawRoundRect(ctx, 6, 6, w - 12, h - 12, 12, null, strokeColor, isHovered ? 4 : 2.5);

        ctx.font = "bold 34px Prompt, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        if (!isPrevDisabled && isHovered) {
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 12;
        }
        ctx.fillText('◄ PREV', w / 2, h / 2 - 10);
        ctx.shadowBlur = 0;

        ctx.font = "bold 18px 'JetBrains Mono', monospace";
        ctx.fillStyle = subColor;
        ctx.fillText('PG BACK', w / 2, h / 2 + 24);

    } else if (type === 'next') {
        const strokeColor = isNextDisabled ? (isLightMode ? '#cbd5e1' : '#334155') : (isHovered ? '#38bdf8' : (isLightMode ? '#0891b2' : '#00f0ff'));
        const textColor = isNextDisabled ? (isLightMode ? '#94a3b8' : '#475569') : (isLightMode ? '#0f172a' : '#ffffff');
        const subColor = isNextDisabled ? (isLightMode ? '#cbd5e1' : '#334155') : (isLightMode ? '#0891b2' : '#00f0ff');

        drawRoundRect(ctx, 6, 6, w - 12, h - 12, 12, null, strokeColor, isHovered ? 4 : 2.5);

        ctx.font = "bold 34px Prompt, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        if (!isNextDisabled && isHovered) {
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 12;
        }
        ctx.fillText('NEXT ►', w / 2, h / 2 - 10);
        ctx.shadowBlur = 0;

        ctx.font = "bold 18px 'JetBrains Mono', monospace";
        ctx.fillStyle = subColor;
        ctx.fillText('PG FWD', w / 2, h / 2 + 24);

    } else if (type === 'mode') {
        const strokeColor = isEng ? (isLightMode ? '#0891b2' : '#00f0ff') : (isLightMode ? '#059669' : '#00ff88');
        const textColor = isLightMode ? '#0f172a' : '#ffffff';
        const modeTitle = isEng ? 'MODE: ENG [A-Z]' : 'MODE: THAI [ก-ฮ]';
        const modeSub = isEng ? `● ACTIVE (PG ${curPage}/${totalPages})` : `● ใช้งานอยู่ (หน้า ${curPage}/${totalPages})`;

        drawRoundRect(ctx, 6, 6, w - 12, h - 12, 12, null, strokeColor, isHovered ? 4 : 2.5);

        // Indicator dot
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(36, h / 2 - 10, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 28px Prompt, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        if (isHovered) {
            ctx.shadowColor = strokeColor;
            ctx.shadowBlur = 14;
        }
        ctx.fillText(modeTitle, w / 2 + 10, h / 2 - 10);
        ctx.shadowBlur = 0;

        ctx.font = "bold 17px 'JetBrains Mono', Prompt, monospace";
        ctx.fillStyle = strokeColor;
        ctx.fillText(modeSub, w / 2, h / 2 + 24);
    }
}

/**
 * Builds interactive 3D tactical buttons (Prev, Next, Mode) on hardware front plate
 */
function createTactical3DButtons() {
    // 1. Prev Button
    btn3DPrevCanvas = document.createElement('canvas');
    btn3DPrevCanvas.width = 256;
    btn3DPrevCanvas.height = 128;
    drawButtonCanvas(btn3DPrevCanvas, 'prev');

    btn3DPrevTexture = new THREE.CanvasTexture(btn3DPrevCanvas);
    btn3DPrevTexture.minFilter = THREE.LinearFilter;
    btn3DPrevTexture.magFilter = THREE.LinearFilter;

    btn3DPrevGroup = new THREE.Group();
    btn3DPrevGroup.position.set(-3.6, 0.02, 3.3);

    const prevBezel = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.06, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 })
    );
    prevBezel.position.y = 0.01;
    btn3DPrevGroup.add(prevBezel);

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const topPrevMat = new THREE.MeshStandardMaterial({ map: btn3DPrevTexture, roughness: 0.2, metalness: 0.7, emissive: 0x00f0ff, emissiveIntensity: 0.15 });
    btn3DPrevMat = topPrevMat;

    const prevMaterials = [sideMat, sideMat, topPrevMat, sideMat, sideMat, sideMat];
    btn3DPrev = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.8), prevMaterials);
    btn3DPrev.position.y = 0.05;
    btn3DPrev.userData = { interactiveType: 'prev', is3DButton: true };
    btn3DPrev.castShadow = true;
    btn3DPrevGroup.add(btn3DPrev);

    scene.add(btn3DPrevGroup);

    // 2. Mode Button
    btn3DModeCanvas = document.createElement('canvas');
    btn3DModeCanvas.width = 384;
    btn3DModeCanvas.height = 128;
    drawButtonCanvas(btn3DModeCanvas, 'mode');

    btn3DModeTexture = new THREE.CanvasTexture(btn3DModeCanvas);
    btn3DModeTexture.minFilter = THREE.LinearFilter;
    btn3DModeTexture.magFilter = THREE.LinearFilter;

    btn3DModeGroup = new THREE.Group();
    btn3DModeGroup.position.set(0.0, 0.02, 3.3);

    const modeBezel = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.06, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 })
    );
    modeBezel.position.y = 0.01;
    btn3DModeGroup.add(modeBezel);

    const topModeMat = new THREE.MeshStandardMaterial({ map: btn3DModeTexture, roughness: 0.2, metalness: 0.7, emissive: 0x00ff88, emissiveIntensity: 0.15 });
    btn3DModeMat = topModeMat;

    const modeMaterials = [sideMat, sideMat, topModeMat, sideMat, sideMat, sideMat];
    btn3DMode = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 0.8), modeMaterials);
    btn3DMode.position.y = 0.05;
    btn3DMode.userData = { interactiveType: 'mode', is3DButton: true };
    btn3DMode.castShadow = true;
    btn3DModeGroup.add(btn3DMode);

    scene.add(btn3DModeGroup);

    // 3. Next Button
    btn3DNextCanvas = document.createElement('canvas');
    btn3DNextCanvas.width = 256;
    btn3DNextCanvas.height = 128;
    drawButtonCanvas(btn3DNextCanvas, 'next');

    btn3DNextTexture = new THREE.CanvasTexture(btn3DNextCanvas);
    btn3DNextTexture.minFilter = THREE.LinearFilter;
    btn3DNextTexture.magFilter = THREE.LinearFilter;

    btn3DNextGroup = new THREE.Group();
    btn3DNextGroup.position.set(3.6, 0.02, 3.3);

    const nextBezel = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.06, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 })
    );
    nextBezel.position.y = 0.01;
    btn3DNextGroup.add(nextBezel);

    const topNextMat = new THREE.MeshStandardMaterial({ map: btn3DNextTexture, roughness: 0.2, metalness: 0.7, emissive: 0x00f0ff, emissiveIntensity: 0.15 });
    btn3DNextMat = topNextMat;

    const nextMaterials = [sideMat, sideMat, topNextMat, sideMat, sideMat, sideMat];
    btn3DNext = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.8), nextMaterials);
    btn3DNext.position.y = 0.05;
    btn3DNext.userData = { interactiveType: 'next', is3DButton: true };
    btn3DNext.castShadow = true;
    btn3DNextGroup.add(btn3DNext);

    scene.add(btn3DNextGroup);
}

/**
 * Triggers interactive button click compression animation
 */
function press3DButton(type) {
    if (btnPressOffsets[type] !== undefined) {
        btnPressOffsets[type] = -0.05;
        setTimeout(() => {
            btnPressOffsets[type] = 0.0;
        }, 130);
    }
}

/**
 * Synchronizes 3D button canvas textures with application pagination & language states
 */
function update3DButtonsState() {
    if (btn3DPrevCanvas) {
        drawButtonCanvas(btn3DPrevCanvas, 'prev');
        if (btn3DPrevTexture) btn3DPrevTexture.needsUpdate = true;
    }
    if (btn3DNextCanvas) {
        drawButtonCanvas(btn3DNextCanvas, 'next');
        if (btn3DNextTexture) btn3DNextTexture.needsUpdate = true;
    }
    if (btn3DModeCanvas) {
        drawButtonCanvas(btn3DModeCanvas, 'mode');
        if (btn3DModeTexture) btn3DModeTexture.needsUpdate = true;
    }
}

/**
 * Builds 14 tactile cells, pins, cams, magnets, and coils
 */
function createBrailleCells() {
    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const camMaterial = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });
    const coilBaseMaterial = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3 });

    const startX = -6.1, cellStepX = 0.94;
    for (let c = 0; c < 14; c++) {
        const cellGroup = new THREE.Group();
        const cellX = startX + c * cellStepX;
        cellGroup.position.set(cellX, 0, 1.4);
        cellGroup.userData = { cellIdx: c };

        const cellBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.02, 1.25), new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.5 }));
        cellBase.position.set(0, 0.005, 0);
        cellGroup.add(cellBase);

        const colOffsets = [-0.16, 0.16];
        const rowOffsets = [-0.32, 0.0, 0.32];
        let pIdx = 0;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const px = colOffsets[col];
                const pz = rowOffsets[row];

                // 1) Pin Shaft & Cap
                const pinGroup = new THREE.Group();
                const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 16), pinMaterial);
                shaftMesh.position.y = -0.27;
                shaftMesh.castShadow = true;
                pinGroup.add(shaftMesh);

                const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), pinMaterial);
                capMesh.position.y = -0.045;
                capMesh.castShadow = true;
                pinGroup.add(capMesh);
                pinGroup.position.set(px, 0.0, pz);
                cellGroup.add(pinGroup);

                // 2) Eccentric Cam
                const camGroup = new THREE.Group();
                const shaftAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 }));
                shaftAxis.rotation.z = Math.PI / 2;
                camGroup.add(shaftAxis);

                const camLobe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16), camMaterial);
                camLobe.position.set(0, 0.035, 0);
                camGroup.add(camLobe);

                const camTip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.07, 16), camMaterial);
                camTip.position.set(0, 0.065, 0);
                camTip.rotation.z = Math.PI;
                camGroup.add(camTip);
                camGroup.position.set(px, -0.42, pz);
                cellGroup.add(camGroup);

                // 3) Bicolor Magnet
                const magnetGroup = new THREE.Group();
                const magN = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 }));
                magN.position.y = 0.025;
                magnetGroup.add(magN);

                const magS = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.6 }));
                magS.position.y = -0.025;
                magnetGroup.add(magS);
                magnetGroup.position.set(px, -0.56, pz);
                cellGroup.add(magnetGroup);

                // 4) Coil
                const coilGroup = new THREE.Group();
                const coilMat = coilBaseMaterial.clone();
                const coilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.22, 16), coilMat);
                coilGroup.add(coilMesh);

                for (let w = -0.08; w <= 0.08; w += 0.04) {
                    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 8, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.1 }));
                    wire.rotation.x = Math.PI / 2;
                    wire.position.y = w;
                    coilGroup.add(wire);
                }

                const fieldGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 12, 24), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0 }));
                fieldGlowRing.rotation.x = Math.PI / 2;
                coilGroup.add(fieldGlowRing);
                coilGroup.position.set(px, -0.72, pz);
                cellGroup.add(coilGroup);

                pinMeshes.push({
                    pinGroup, camGroup, magnetGroup, coilGroup, coilMesh, coilMat, fieldGlowRing,
                    currentCoilY: -0.72, targetY: 0.0, currentY: 0.0, targetCamAngle: 0, currentCamAngle: 0,
                    cellIdx: c, dotIdx: pIdx
                });
                pIdx++;
            }
        }
        scene.add(cellGroup);
        cellGroups.push(cellGroup);
    }
}

/**
 * Main WebGL Render Loop with Smooth Lerping
 */
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();

    updateScreenCanvas();
    if (screenTexture) screenTexture.needsUpdate = true;
    if (oledTexture) oledTexture.needsUpdate = true;

    for (let i = 0; i < pinMeshes.length; i++) {
        const p = pinMeshes[i];
        const targetY = (pinTargetY[i] !== undefined) ? pinTargetY[i] : p.targetY;
        const targetCam = (pinTargetCamAngle[i] !== undefined) ? pinTargetCamAngle[i] : p.targetCamAngle;

        p.currentY += (targetY - p.currentY) * 0.15;
        p.pinGroup.position.y = p.currentY;

        p.currentCamAngle += (targetCam - p.currentCamAngle) * 0.15;
        if (p.camGroup) p.camGroup.rotation.x = p.currentCamAngle;

        if (p.magnetGroup) {
            const targetMagY = -0.56 + (targetY > 0.04 ? 0.03 : 0);
            p.magnetGroup.position.y += (targetMagY - p.magnetGroup.position.y) * 0.15;
            p.magnetGroup.rotation.x = p.currentCamAngle;
        }

        if (p.coilMat && p.fieldGlowRing) {
            if (targetY > 0.04) {
                p.coilMat.emissive.setHex(0x00f0ff);
                p.coilMat.emissiveIntensity = 0.7;
                p.fieldGlowRing.material.opacity = 0.8;
            } else {
                p.coilMat.emissive.setHex(0x000000);
                p.coilMat.emissiveIntensity = 0.0;
                p.fieldGlowRing.material.opacity = 0.0;
            }
        }
    }

    // Lerp 3D Tactical Button Positions (Tactile Click Press Response)
    if (btn3DPrev) {
        btn3DPrev.position.y += ((btnBaseYs.prev + btnPressOffsets.prev) - btn3DPrev.position.y) * 0.35;
    }
    if (btn3DNext) {
        btn3DNext.position.y += ((btnBaseYs.next + btnPressOffsets.next) - btn3DNext.position.y) * 0.35;
    }
    if (btn3DMode) {
        btn3DMode.position.y += ((btnBaseYs.mode + btnPressOffsets.mode) - btn3DMode.position.y) * 0.35;
    }

    if (explodedLayers.length) {
        if (explodedAnimStart) {
            const elapsed = performance.now() - explodedAnimStart;
            const t = Math.min(elapsed / explodedAnimDuration, 1);
            explodedProgress = explodedAnimFrom + (explodedAnimTo - explodedAnimFrom) * easeInOutCubic(t);
            if (t >= 1) {
                explodedProgress = explodedAnimTo;
                explodedAnimStart = 0;
            }
        }
        applyExplodedLayerPositions();
        if (explodedLabelsVisible) updateExplodedLabelPositions();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * Toggles X-Ray Cutaway transparent casing
 */
function toggleXRay() {
    isXRay = !isXRay;
    const btnHeader = document.getElementById('xrayBtn');
    const btnOverlay = document.getElementById('btnViewXray');

    if (isXRay) {
        if (chassisMesh) chassisMesh.material = chassisMaterialGlass;
        if (plateMesh) {
            plateMesh.material.transparent = true;
            plateMesh.material.opacity = 0.25;
        }
        if (btnHeader) {
            btnHeader.classList.add('active');
            btnHeader.innerHTML = '<i class="fa-solid fa-eye-slash"></i> 👁️ โหมดกล่องทึบ (Solid Box)';
        }
        if (btnOverlay) {
            btnOverlay.classList.add('active');
            btnOverlay.innerHTML = '<i class="fa-solid fa-eye-slash"></i> โหมดกล่องทึบ (Solid Box)';
        }
    } else {
        if (chassisMesh) chassisMesh.material = chassisMaterialSolid;
        if (plateMesh) {
            plateMesh.material.transparent = false;
            plateMesh.material.opacity = 1.0;
        }
        if (btnHeader) {
            btnHeader.classList.remove('active');
            btnHeader.innerHTML = '<i class="fa-solid fa-eye"></i> 👁️ โหมดกล่องโปร่งใส (X-Ray Cutaway)';
        }
        if (btnOverlay) {
            btnOverlay.classList.remove('active');
            btnOverlay.innerHTML = '<i class="fa-solid fa-eye"></i> โหมดกล่องโปร่งใส (X-Ray)';
        }
    }
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setupExplodedLayers() {
    explodedLayers = [
        { id: 1, nameTh: 'เคสล่าง / แบตเตอรี่', nameEn: 'Bottom Case / Battery', offset: 0, objects: [], anchor: new THREE.Vector3(0, -1.35, 3.6) },
        { id: 2, nameTh: 'แผงวงจรหลัก (PCB)', nameEn: 'Main PCB Board', offset: 1.5, objects: internalGroup ? [internalGroup] : [] },
        { id: 3, nameTh: 'ชุดกล้องด้านหลัง', nameEn: 'Rear Camera Module', offset: 3.0, objects: rearGroup ? [rearGroup] : [] },
        { id: 4, nameTh: 'แผงหมุดเบรลล์ 14 เซลล์', nameEn: '14-Cell Braille Pin Array', offset: 4.5, objects: cellGroups.slice() },
        { id: 5, nameTh: 'ชุดจอแสดงผล TFT', nameEn: 'TFT Display Assembly', offset: 6.0, objects: [tftPcbMesh, screenMesh, oledGlass, bezelRim].filter(Boolean) },
        { id: 6, nameTh: 'เคสบน / ฝาครอบ', nameEn: 'Top Case / Cover', offset: 7.5, objects: [chassisMesh, plateMesh, btn3DPrevGroup, btn3DNextGroup, btn3DModeGroup].filter(Boolean) }
    ];

    explodedLayers.forEach(layer => {
        layer.baseYs = layer.objects.map(o => o.position.y);
        layer.anchorObj = layer.objects.length ? layer.objects[Math.floor(layer.objects.length / 2)] : null;
    });

    buildExplodedLabelDOM();
}

function buildExplodedLabelDOM() {
    explodedLabelsLayerEl = document.getElementById('explodedLabelsLayer');
    explodedLinesSvg = document.getElementById('explodedLinesSvg');
    if (!explodedLabelsLayerEl || !explodedLinesSvg) return;

    explodedLabelsLayerEl.innerHTML = '';
    explodedLinesSvg.innerHTML = '';

    const sideOffsets = [
        { dx: -180, dy: 75 }, { dx: 180, dy: 55 }, { dx: -200, dy: 15 },
        { dx: 200, dy: -15 }, { dx: -180, dy: -55 }, { dx: 180, dy: -100 }
    ];

    explodedLayers.forEach((layer, idx) => {
        const off = sideOffsets[idx % sideOffsets.length];
        layer.labelDX = off.dx;
        layer.labelDY = off.dy;

        const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineEl.setAttribute('class', 'exploded-line');
        explodedLinesSvg.appendChild(lineEl);
        layer.lineEl = lineEl;

        const labelEl = document.createElement('div');
        labelEl.className = 'exploded-label';
        labelEl.innerHTML = `
            <div class="exploded-label-num">${layer.id}</div>
            <div class="exploded-label-text">
                <div class="exploded-label-th">${layer.nameTh}</div>
                <div class="exploded-label-en">${layer.nameEn}</div>
            </div>
        `;
        explodedLabelsLayerEl.appendChild(labelEl);
        layer.labelEl = labelEl;
    });
}

function startExplodedTween(target, duration) {
    explodedAnimFrom = explodedProgress;
    explodedAnimTo = target;
    explodedAnimDuration = duration || 1000;
    explodedAnimStart = performance.now();
}

function applyExplodedLayerPositions() {
    explodedLayers.forEach(layer => {
        layer.objects.forEach((obj, idx) => {
            if (!obj) return;
            obj.position.y = layer.baseYs[idx] + layer.offset * explodedProgress;
        });
    });
}

function worldToScreen(vector3, container) {
    const v = vector3.clone();
    v.project(camera);
    const halfW = container.clientWidth / 2;
    const halfH = container.clientHeight / 2;
    return { x: (v.x * halfW) + halfW, y: -(v.y * halfH) + halfH };
}

function updateExplodedLabelPositions() {
    const container = document.getElementById('webgl-container');
    if (!container || !camera) return;

    explodedLayers.forEach(layer => {
        if (!layer.labelEl) return;
        let worldPos;
        if (layer.anchorObj) {
            worldPos = new THREE.Vector3();
            layer.anchorObj.getWorldPosition(worldPos);
        } else if (layer.anchor) {
            worldPos = layer.anchor;
        } else {
            return;
        }

        const pt = worldToScreen(worldPos, container);
        const labelX = pt.x + layer.labelDX;
        const labelY = pt.y + layer.labelDY;

        layer.labelEl.style.left = labelX + 'px';
        layer.labelEl.style.top = labelY + 'px';

        if (layer.lineEl) {
            layer.lineEl.setAttribute('x1', labelX);
            layer.lineEl.setAttribute('y1', labelY);
            layer.lineEl.setAttribute('x2', pt.x);
            layer.lineEl.setAttribute('y2', pt.y);
        }
    });
}

function showExplodedLabels() {
    explodedLabelsVisible = true;
    updateExplodedLabelPositions();
    explodedLayers.forEach(layer => {
        if (layer.labelEl) layer.labelEl.classList.add('visible');
        if (layer.lineEl) layer.lineEl.classList.add('visible');
    });
}

function hideExplodedLabels() {
    explodedLabelsVisible = false;
    explodedLayers.forEach(layer => {
        if (layer.labelEl) layer.labelEl.classList.remove('visible');
        if (layer.lineEl) layer.lineEl.classList.remove('visible');
    });
}

function toggleExplodedView() {
    isExploded = !isExploded;
    const btn = document.getElementById('explodedBtn');
    const sliderWrap = document.getElementById('explodedSliderWrap');

    if (isExploded) {
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> 🧩 ปิดโหมดแยกชิ้นส่วน (Exit Exploded View)';
        }
        if (sliderWrap) sliderWrap.style.display = 'flex';
        startExplodedTween(explodedAmount, 1000);
        showExplodedLabels();
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> 🧩 โหมดแยกชิ้นส่วน (Exploded View)';
        }
        if (sliderWrap) sliderWrap.style.display = 'none';
        startExplodedTween(0, 1000);
        hideExplodedLabels();
    }
}

function setExplodedAmount(percent) {
    explodedAmount = Math.max(0, Math.min(100, Number(percent))) / 100;
    const valEl = document.getElementById('explodedSliderVal');
    if (valEl) valEl.innerText = Math.round(explodedAmount * 100) + '%';
    if (isExploded) startExplodedTween(explodedAmount, 300);
}

function applyThemeToScene() {
    if (!scene) return;
    const cyanHex = isLightMode ? 0x0891B2 : 0x00F0FF;
    const emeraldHex = isLightMode ? 0x059669 : 0x00FF88;
    const amberHex = isLightMode ? 0xB45309 : 0xFFB800;

    if (isLightMode) {
        scene.background = null;
        if (renderer) renderer.setClearColor(0x000000, 0);
    } else {
        scene.background = new THREE.Color(0x070A13);
        if (renderer) renderer.setClearColor(0x070A13, 1);
    }

    if (ledFront) ledFront.material.color.setHex(cyanHex);
    if (ledBack) ledBack.material.color.setHex(cyanHex);
    if (stripeMesh) stripeMesh.material.color.setHex(cyanHex);
    if (dividerMesh) dividerMesh.material.emissive.setHex(cyanHex);
    if (pwrRing) pwrRing.material.color.setHex(emeraldHex);
    if (ledPwrMesh) ledPwrMesh.material.color.setHex(emeraldHex);
    if (ledDataMesh) ledDataMesh.material.color.setHex(cyanHex);
    if (ledFlashMesh) ledFlashMesh.material.color.setHex(amberHex);

    pinMeshes.forEach(p => {
        if (p.fieldGlowRing) p.fieldGlowRing.material.color.setHex(cyanHex);
    });

    if (ambientLightRef) ambientLightRef.intensity = isLightMode ? 0.95 : 0.75;
    if (typeof mechScene !== 'undefined' && mechScene) {
        mechScene.background = new THREE.Color(isLightMode ? 0xF5F7FA : 0x080d1a);
    }
    update3DButtonsState();
}

function toggleLightMode() {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode', isLightMode);

    const btn = document.getElementById('lightModeBtn');
    if (btn) {
        btn.innerHTML = isLightMode
            ? '<i class="fa-solid fa-moon"></i> 🌙 โหมดมืด (Dark Mode)'
            : '<i class="fa-solid fa-sun"></i> ☀️ โหมดสว่าง (Light Mode)';
    }

    try {
        localStorage.setItem('braillens-theme', isLightMode ? 'light' : 'dark');
    } catch (e) {}

    applyThemeToScene();
}

function setCameraView(view) {
    if (controls) controls.autoRotate = false;
    document.querySelectorAll('.viewport-overlay .cam-btn').forEach(b => b.classList.remove('active'));

    switch (view) {
        case 'front':
            camera.position.set(0, 13.5, 0.2);
            controls.target.set(0, 0, -0.5);
            if (document.getElementById('btnViewFront')) document.getElementById('btnViewFront').classList.add('active');
            break;
        case 'back':
            camera.position.set(0, -13.5, 0.01);
            controls.target.set(0, -0.6, 0);
            if (document.getElementById('btnViewBack')) document.getElementById('btnViewBack').classList.add('active');
            break;
        case '3d':
        case 'iso':
            camera.position.set(9, 10, 11);
            controls.target.set(0, -0.3, -0.5);
            if (document.getElementById('btnView3D')) document.getElementById('btnView3D').classList.add('active');
            break;
    }
    if (controls) controls.update();
}

function resetCamera() {
    setCameraView('3d');
}

function togglePresentation() {
    isPresenting = !isPresenting;
    const btn = document.getElementById('presentBtn');
    const presets = ['สวัสดีครับ', 'ยินดีต้อนรับ', 'BraillLens', 'การเรียนรู้อักษรเบรลล์'];
    let idx = 0;

    if (isPresenting) {
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-square"></i> หยุดนำเสนอ';
        }
        if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 2.0;
        }
        if (typeof setPreset === 'function') setPreset(presets[0]);
        presentInterval = setInterval(() => {
            idx = (idx + 1) % presets.length;
            if (typeof setPreset === 'function') setPreset(presets[idx]);
        }, 4000);
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-play"></i> 🎬 Presentation Mode';
        }
        if (controls) controls.autoRotate = false;
        clearInterval(presentInterval);
    }
}

function onWindowResize() {
    const container = document.getElementById('webgl-container');
    if (container && camera && renderer) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

// 3D Single-Pin Mechanism Modal
let mechScene, mechCamera, mechRenderer, mechControls;
let mechCoilMesh, mechMagnetMesh, mechCamMesh, mechPinMesh, mechFieldGroup;
let currentMechState = 1;

function initMechanism3D() {
    const canvas = document.getElementById('mech-canvas');
    if (!canvas) return;
    const container = canvas.parentElement;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    mechScene = new THREE.Scene();
    mechScene.background = new THREE.Color(0x080d1a);

    mechCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    mechCamera.position.set(0, 1.5, 7.5);

    mechRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    mechRenderer.setSize(width, height);
    mechRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    mechControls = new THREE.OrbitControls(mechCamera, mechRenderer.domElement);
    mechControls.enableDamping = true;

    mechScene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0x00f0ff, 1.0);
    dir.position.set(5, 10, 5);
    mechScene.add(dir);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.2, 3.0), new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7 }));
    frame.position.set(0, -2.4, 0);
    mechScene.add(frame);

    const pillarMat = new THREE.MeshPhysicalMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.3, transmission: 0.8 });
    [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(pos => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2), pillarMat);
        pillar.position.set(pos[0], -0.3, pos[1]);
        mechScene.add(pillar);
    });

    const coilGroup = new THREE.Group();
    mechCoilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 32), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.3 }));
    coilGroup.add(mechCoilMesh);

    for (let y = -0.6; y <= 0.6; y += 0.15) {
        const wire = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.05, 12, 32), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.1 }));
        wire.rotation.x = Math.PI / 2;
        wire.position.y = y;
        coilGroup.add(wire);
    }
    coilGroup.position.set(0, -1.3, 0);
    mechScene.add(coilGroup);

    mechFieldGroup = new THREE.Group();
    for (let r = 0; r < 4; r++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95 + r * 0.22, 0.025, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.3;
        mechFieldGroup.add(ring);
    }
    mechScene.add(mechFieldGroup);

    const magnetGroup = new THREE.Group();
    const magN = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.45, 32), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 }));
    magN.position.y = 0.225;
    magnetGroup.add(magN);
    const magS = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.45, 32), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5 }));
    magS.position.y = -0.225;
    magnetGroup.add(magS);
    magnetGroup.position.set(0, -1.3, 0);
    mechMagnetMesh = magnetGroup;
    mechScene.add(mechMagnetMesh);

    const camGroup = new THREE.Group();
    const camAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 }));
    camAxis.rotation.z = Math.PI / 2;
    camGroup.add(camAxis);
    const camLobe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 32), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
    camLobe.position.set(0, 0.22, 0);
    camGroup.add(camLobe);
    const camTip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 32), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
    camTip.position.set(0, 0.45, 0);
    camTip.rotation.z = Math.PI;
    camGroup.add(camTip);
    camGroup.position.set(0, 0.2, 0);
    mechCamMesh = camGroup;
    mechScene.add(mechCamMesh);

    const pinGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 32), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }));
    shaft.position.y = 0.95;
    pinGroup.add(shaft);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }));
    head.position.y = 1.9;
    pinGroup.add(head);
    pinGroup.position.set(0, 0.65, 0);
    mechPinMesh = pinGroup;
    mechScene.add(mechPinMesh);

    function animateMech() {
        requestAnimationFrame(animateMech);
        if (mechControls) mechControls.update();
        if (currentMechState === 2 || currentMechState === 4) {
            const time = Date.now() * 0.006;
            mechFieldGroup.children.forEach((ring, idx) => {
                ring.material.opacity = 0.4 + Math.sin(time + idx * 0.8) * 0.4;
            });
        }
        if (mechRenderer && mechScene && mechCamera) {
            mechRenderer.render(mechScene, mechCamera);
        }
    }
    animateMech();
}

function openMechanismModal() {
    const modal = document.getElementById('mechanismModal');
    if (modal) modal.classList.add('active');
    if (!mechScene) setTimeout(initMechanism3D, 50);
    setMechState(1);
}

function closeMechanismModal() {
    const modal = document.getElementById('mechanismModal');
    if (modal) modal.classList.remove('active');
}

function setMechState(st) {
    currentMechState = st;
    document.querySelectorAll('.state-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`stBtn${st}`);
    if (activeBtn) activeBtn.classList.add('active');

    const pPower = document.getElementById('prmPower');
    const pCurrent = document.getElementById('prmCurrent');
    const pFlux = document.getElementById('prmFlux');
    const pCam = document.getElementById('prmCam');
    const pPin = document.getElementById('prmPin');
    const pLatch = document.getElementById('prmLatch');
    const desc = document.getElementById('mechDesc');

    if (!mechFieldGroup) return;
    mechFieldGroup.children.forEach(r => r.material.opacity = 0);

    switch (st) {
        case 1:
            if (pPower) pPower.innerText = '0.0 W';
            if (pCurrent) pCurrent.innerText = '0.00 A';
            if (pFlux) pFlux.innerText = '0.00 T';
            if (pCam) pCam.innerText = '0°';
            if (pPin) pPin.innerText = 'DOWN (0.0mm)';
            if (pLatch) pLatch.innerText = 'UNLOCKED';
            if (mechMagnetMesh) mechMagnetMesh.position.y = -1.3;
            if (mechCamMesh) mechCamMesh.rotation.x = 0;
            if (mechPinMesh) mechPinMesh.position.y = 0.65;
            if (desc) desc.innerHTML = '⚪ <b style="color:var(--accent-cyan)">สถานะ 1: สภาวะพัก (No Power - Idle Down)</b><br>ไม่มีกระแสไฟฟ้าไหลผ่านขดลวด (0.0W) หมุดเบรลล์อยู่ในตำแหน่งพักด้านล่าง (DOWN - 0.0mm) ไม่มีการสิ้นเปลืองพลังงานไฟฟ้าแม้แต่มิลลิวัตต์เดียว';
            break;
        case 2:
            if (pPower) pPower.innerText = '2.4 W (Pulse)';
            if (pCurrent) pCurrent.innerText = '0.48 A';
            if (pFlux) pFlux.innerText = '0.85 T';
            if (pCam) pCam.innerText = '180°';
            if (pPin) pPin.innerText = 'UP (1.2mm)';
            if (pLatch) pLatch.innerText = 'LATCHING...';
            mechFieldGroup.children.forEach(r => { r.material.color.setHex(0x00f0ff); r.material.opacity = 0.8; });
            if (mechMagnetMesh) mechMagnetMesh.position.y = -0.9;
            if (mechCamMesh) mechCamMesh.rotation.x = Math.PI;
            if (mechPinMesh) mechPinMesh.position.y = 0.89;
            if (desc) desc.innerHTML = '⚡ <b style="color:var(--accent-emerald)">สถานะ 2: จ่ายไฟพัลส์ (Coil ON - Actuation Pulse)</b><br>จ่ายกระแสไฟพัลส์สั้นๆ (50ms) ผ่านขดลวดทองแดง เกิดสนามแม่เหล็กผลักแม่เหล็กถาวรดันลูกเบี้ยว (Eccentric Cam) หมุน 180° ผลักหมุดเบรลล์ขึ้นสู่ตำแหน่งใช้งาน (UP - 1.2mm)';
            break;
        case 3:
            if (pPower) pPower.innerText = '0.0 W (0W Latch!)';
            if (pCurrent) pCurrent.innerText = '0.00 A';
            if (pFlux) pFlux.innerText = '0.00 T';
            if (pCam) pCam.innerText = '180° (Locked)';
            if (pPin) pPin.innerText = 'UP (1.2mm)';
            if (pLatch) pLatch.innerText = 'MECHANICAL LATCHED';
            if (mechMagnetMesh) mechMagnetMesh.position.y = -0.9;
            if (mechCamMesh) mechCamMesh.rotation.x = Math.PI;
            if (mechPinMesh) mechPinMesh.position.y = 0.89;
            if (desc) desc.innerHTML = '🌱 <b style="color:var(--accent-emerald)">สถานะ 3: ตัดไฟ (Power OFF - Bistable Zero-Hold Power)</b><br><span class="highlight-power">ตัดกระแสไฟฟ้า 100%!</span> กลไกลูกเบี้ยวทรงหยดน้ำและแม่เหล็กถาวรล็อกตำแหน่งหมุดเบรลล์ให้อยู่ด้านบน (UP) ได้อย่างมั่นคงโดยไม่ต้องจ่ายไฟเลี้ยง';
            break;
        case 4:
            if (pPower) pPower.innerText = '2.4 W (Pulse)';
            if (pCurrent) pCurrent.innerText = '0.48 A';
            if (pFlux) pFlux.innerText = '-0.85 T';
            if (pCam) pCam.innerText = '0°';
            if (pPin) pPin.innerText = 'DOWN (0.0mm)';
            if (pLatch) pLatch.innerText = 'UNLOCKED';
            mechFieldGroup.children.forEach(r => { r.material.color.setHex(0xff0055); r.material.opacity = 0.8; });
            if (mechMagnetMesh) mechMagnetMesh.position.y = -1.3;
            if (mechCamMesh) mechCamMesh.rotation.x = 0;
            if (mechPinMesh) mechPinMesh.position.y = 0.65;
            if (desc) desc.innerHTML = '🔄 <b style="color:var(--accent-magenta)">สถานะ 4: สลับขั้วไฟฟ้า (Reverse Polarity Reset)</b><br>จ่ายไฟกลับทิศทางสร้างสนามแม่เหล็กดึงลูกเบี้ยวหมุนกลับตำแหน่ง 0° ดึงหมุดเบรลล์ลดระดับลงสู่ตำแหน่งพัก (DOWN - 0.0mm) พร้อมรับคำสั่งใหม่';
            break;
    }
}
