/* =========================================================================
   BraillLens 3D & Optical OCR System - Application Entry Point
   Version: 3.1.0 (Modular Initialization & Event Dispatcher)
   ========================================================================= */

/**
 * Restores saved theme (dark / light) from localStorage
 */
function restoreSavedTheme() {
    let savedTheme = 'dark';
    try {
        savedTheme = localStorage.getItem('braillens-theme') || 'dark';
    } catch (e) {}

    if (savedTheme === 'light') {
        if (typeof isLightMode !== 'undefined') isLightMode = true;
        document.body.classList.add('light-mode');
        const btn = document.getElementById('lightModeBtn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-moon"></i> 🌙 โหมดมืด (Dark Mode)';
        }
    }
}

// Restore saved theme immediately upon script load
restoreSavedTheme();

// Initialize all subsystems when DOM content is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize 3D WebGL Scene & Controls
    if (typeof initMain3D === 'function') {
        initMain3D();
    }

    // 2. Sync Theme with 3D Scene
    if (typeof applyThemeToScene === 'function') {
        applyThemeToScene();
    }

    // 3. Render initial Screen LCD Texture
    if (typeof updateScreenCanvas === 'function') {
        updateScreenCanvas("HELLO WORLD");
    }

    // 4. Bind Input Textarea Events
    const inputEl = document.getElementById('thaiInput');
    if (inputEl) {
        ['input', 'change', 'keyup'].forEach(evt => {
            inputEl.addEventListener(evt, (e) => {
                if (typeof updateBrailleDisplay === 'function') {
                    updateBrailleDisplay(e.target.value);
                }
            });
        });
    }

    // 5. Initial Braille Actuation
    if (typeof updateBrailleDisplay === 'function') {
        updateBrailleDisplay();
    }

    // 6. Bind OCR, Camera, and Tactile Navigation Handlers
    if (typeof initOCRHandlers === 'function') {
        initOCRHandlers();
    }
});
