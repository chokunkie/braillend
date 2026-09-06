/**
 * Tactile Shapes & 12-Dot Graphic Matrix Engine
 * -------------------------------------------------------------
 * Manages 8 standard tactile graphics presets & custom 12-dot matrix
 * Physical Layout (3 rows x 4 cols):
 *   Row 1:  1   4   7  10
 *   Row 2:  2   5   8  11
 *   Row 3:  3   6   9  12
 */

const TACTILE_PRESETS = [
    {
        id: '1.1',
        name: 'สามเหลี่ยมขึ้น',
        symbol: '▲',
        category: 'รูปทรงเรขาคณิต',
        dots: [2, 4, 5, 7, 8, 11],
        description: 'รูปทรงสามเหลี่ยมชี้ขึ้น (ทิศเหนือ / เลื่อนขึ้น)'
    },
    {
        id: '1.2',
        name: 'สามเหลี่ยมลง',
        symbol: '▼',
        category: 'รูปทรงเรขาคณิต',
        dots: [2, 5, 6, 8, 9, 11],
        description: 'รูปทรงสามเหลี่ยมชี้ลง (ทิศใต้ / เลื่อนลง)'
    },
    {
        id: '2.1',
        name: 'สี่เหลี่ยมทึบ',
        symbol: '■',
        category: 'รูปทรงเรขาคณิต',
        dots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        description: 'สี่เหลี่ยมผืนผ้าทึบ (ดันทุกจุด 1-12)'
    },
    {
        id: '2.2',
        name: 'สี่เหลี่ยมกรอบ',
        symbol: '□',
        category: 'รูปทรงเรขาคณิต',
        dots: [1, 2, 3, 4, 6, 7, 9, 10, 11, 12],
        description: 'สี่เหลี่ยมกรอบโปร่ง (เว้นจุดกึ่งกลาง 5, 8)'
    },
    {
        id: '3.1',
        name: 'วงกลมโปร่ง',
        symbol: '○',
        category: 'รูปทรงเรขาคณิต',
        dots: [2, 4, 6, 7, 9, 11],
        description: 'วงกลมโปร่ง (สถานะยังไม่เลือก / ค่าว่าง)'
    },
    {
        id: '3.2',
        name: 'วงกลมทึบ',
        symbol: '●',
        category: 'รูปทรงเรขาคณิต',
        dots: [2, 4, 5, 6, 7, 8, 9, 11],
        description: 'วงกลมทึบ (สถานะเลือกแล้ว / ถูกต้อง)'
    },
    {
        id: '5',
        name: 'กากบาท',
        symbol: '✕',
        category: 'สัญลักษณ์เตือน',
        dots: [1, 3, 5, 8, 10, 12],
        description: 'เครื่องหมายผิด / ยกเลิก / อันตราย'
    },
    {
        id: '6',
        name: 'เครื่องหมายถูก',
        symbol: '✓',
        category: 'สัญลักษณ์เตือน',
        dots: [2, 6, 8, 10],
        description: 'เครื่องหมายถูกต้อง / อนุมัติ / ผ่าน'
    }
];

class TactileShapesManager {
    constructor() {
        this.presets = TACTILE_PRESETS;
        this.customDots = new Set(); // Stores dot numbers 1..12
        this.currentShape = null;
        this.onShapeSelect = null;
    }

    /**
     * Convert dots array (e.g. [2,4,5,7,8,11]) to 12-bit binary string
     */
    static dotsToBitstring(dotsArray) {
        const bits = new Array(12).fill('0');
        dotsArray.forEach(dot => {
            const idx = dot - 1;
            if (idx >= 0 && idx < 12) {
                bits[idx] = '1';
            }
        });
        return bits.join('');
    }

    /**
     * Convert 12-bit binary string to array of active dot numbers (1..12)
     */
    static bitstringToDots(bits12) {
        const dots = [];
        const str = String(bits12);
        for (let i = 0; i < 12 && i < str.length; i++) {
            if (str[i] === '1') {
                dots.push(i + 1);
            }
        }
        return dots;
    }

    /**
     * Select a preset by ID and return its bitstring
     */
    selectPreset(id) {
        const preset = this.presets.find(p => p.id === id);
        if (!preset) return null;

        this.currentShape = preset;
        const bitstring = TactileShapesManager.dotsToBitstring(preset.dots);

        if (typeof this.onShapeSelect === 'function') {
            this.onShapeSelect({
                preset: preset,
                bitstring: bitstring,
                dots: preset.dots
            });
        }

        return { preset, bitstring };
    }

    /**
     * Toggle a single dot in custom 12-dot matrix
     */
    toggleCustomDot(dotNumber) {
        if (dotNumber < 1 || dotNumber > 12) return;

        if (this.customDots.has(dotNumber)) {
            this.customDots.delete(dotNumber);
        } else {
            this.customDots.add(dotNumber);
        }

        const bitstring = TactileShapesManager.dotsToBitstring(Array.from(this.customDots));
        this.currentShape = {
            id: 'custom',
            name: 'กำหนดเอง',
            symbol: '✏️',
            category: 'กำหนดเอง',
            dots: Array.from(this.customDots).sort((a, b) => a - b),
            description: 'ปรับแต่งจุดสัมผัสอิสระ'
        };

        if (typeof this.onShapeSelect === 'function') {
            this.onShapeSelect({
                preset: this.currentShape,
                bitstring: bitstring,
                dots: this.currentShape.dots
            });
        }

        return { preset: this.currentShape, bitstring };
    }

    clearCustomDots() {
        this.customDots.clear();
        return this.toggleCustomDot(0); // refresh
    }

    fillAllDots() {
        this.customDots = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const bitstring = "111111111111";
        this.currentShape = this.presets[2]; // ■
        if (typeof this.onShapeSelect === 'function') {
            this.onShapeSelect({
                preset: this.currentShape,
                bitstring: bitstring,
                dots: Array.from(this.customDots)
            });
        }
        return { preset: this.currentShape, bitstring };
    }
}

// Global browser registration
if (typeof window !== 'undefined') {
    window.TACTILE_PRESETS = TACTILE_PRESETS;
    window.TactileShapesManager = TactileShapesManager;
    window.tactileShapes = new TactileShapesManager();
}

// Node.js CommonJS export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TACTILE_PRESETS,
        TactileShapesManager
    };
}
