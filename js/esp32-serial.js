/**
 * ESP32 Web Serial Communication Manager
 * -------------------------------------------------------------
 * Communicates with ESP32 Solenoid Board over Web Serial API at 115200 baud.
 * Features:
 * - Silent Auto-Connect on page load for previously granted ports
 * - Reconnect on device plugged in
 * - 12-Bit payload validation and queuing
 * - Telemetry & event dispatching for UI
 * - Offline Mock Simulator for headless/demo testing
 */

class ESP32SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.baudRate = 115200;
        this.lastCommand = null;
        this.eventListeners = {};
        this.isMockMode = false;

        // Auto-initialize browser listeners if in browser environment
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            this.initBrowserListeners();
        }
    }

    /**
     * Listen for USB connect/disconnect events
     */
    initBrowserListeners() {
        if ('serial' in navigator) {
            navigator.serial.addEventListener('connect', (e) => {
                this.emit('log', { level: 'info', message: 'ตรวจพบอุปกรณ์ ESP32 เสียบเข้าพอร์ต' });
                this.autoConnect();
            });

            navigator.serial.addEventListener('disconnect', (e) => {
                this.emit('log', { level: 'warn', message: 'ESP32 ถูกถอดออกจากพอร์ต' });
                this.handleDisconnect();
            });
        }
    }

    /**
     * Event emitter
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(cb => {
                try { cb(data); } catch (err) { console.error('Serial event listener error:', err); }
            });
        }
    }

    /**
     * Silent Auto-Connect: Checks if browser already has permission to an ESP32 port
     */
    async autoConnect() {
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
            this.emit('status', { connected: false, mock: true, message: 'Web Serial ไม่รองรับ (ใช้งานโหมดจำลอง)' });
            this.isMockMode = true;
            return false;
        }

        try {
            const ports = await navigator.serial.getPorts();
            if (ports && ports.length > 0) {
                this.emit('log', { level: 'info', message: `พบพอร์ตที่เคยอนุญาตไว้ ${ports.length} พอร์ต กำลังเชื่อมต่ออัตโนมัติ...` });
                return await this.openPort(ports[0]);
            } else {
                this.emit('status', { connected: false, mock: false, message: 'ยังไม่ได้เลือกพอร์ต ESP32 (กดเชื่อมต่อเพื่อเริ่ม)' });
                return false;
            }
        } catch (err) {
            this.emit('error', { message: 'เกิดข้อผิดพลาดในการ Auto-Connect: ' + err.message });
            return false;
        }
    }

    /**
     * User-prompted Port Selection (First time setup)
     */
    async requestPort() {
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
            this.emit('error', { message: 'เบราว์เซอร์นี้ไม่รองรับ Web Serial API (โปรดใช้ Google Chrome หรือ Microsoft Edge)' });
            this.isMockMode = true;
            return false;
        }

        try {
            this.isConnecting = true;
            this.emit('status', { connected: false, connecting: true, message: 'กำลังรอผู้ใช้เลือกพอร์ต ESP32...' });
            
            const port = await navigator.serial.requestPort();
            return await this.openPort(port);
        } catch (err) {
            this.isConnecting = false;
            if (err.name === 'NotFoundError') {
                this.emit('status', { connected: false, message: 'ยกเลิกการเลือกพอร์ต' });
            } else {
                this.emit('error', { message: 'ไม่สามารถเลือกพอร์ตได้: ' + err.message });
            }
            return false;
        }
    }

    /**
     * Open Port with 115200 baud
     */
    async openPort(port) {
        try {
            this.port = port;
            await this.port.open({ baudRate: this.baudRate });
            this.isConnected = true;
            this.isConnecting = false;
            this.isMockMode = false;

            const info = this.port.getInfo ? this.port.getInfo() : {};
            const portDesc = info.usbVendorId ? `USB VID:${info.usbVendorId.toString(16)}` : 'ESP32 COM Port';

            this.emit('status', { 
                connected: true, 
                portDesc: portDesc,
                baudRate: this.baudRate,
                message: `เชื่อมต่อ ESP32 สำเร็จ (${this.baudRate} baud)` 
            });

            this.startReadLoop();
            return true;
        } catch (err) {
            this.isConnected = false;
            this.isConnecting = false;
            this.emit('error', { message: 'เปิดพอร์ตล้มเหลว: ' + err.message });
            return false;
        }
    }

    /**
     * Read loop for ESP32 Serial Monitor responses
     */
    async startReadLoop() {
        if (!this.port || !this.port.readable) return;

        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        try {
            while (this.isConnected && this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) {
                    this.emit('rx', { data: value.trim() });
                }
            }
        } catch (err) {
            // Stream closed or error
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch(e){}
            }
        }
    }

    /**
     * Send 12-Bit String to ESP32 (e.g. "110100001010")
     * Validates exactly 12 characters of '0' and '1'
     */
    async send12BitCommand(bits12) {
        const cleaned = String(bits12).trim();

        // Validation
        if (cleaned.length !== 12) {
            const err = `ERROR: รหัสต้องมี 12 หลัก (ได้รับ ${cleaned.length} หลัก: "${cleaned}")`;
            this.emit('error', { message: err });
            return { success: false, error: err };
        }

        for (let i = 0; i < 12; i++) {
            if (cleaned[i] !== '0' && cleaned[i] !== '1') {
                const err = `ERROR: รหัสต้องเป็น 0 หรือ 1 เท่านั้น (พบอักขระ "${cleaned[i]}" ที่ตำแหน่ง ${i+1})`;
                this.emit('error', { message: err });
                return { success: false, error: err };
            }
        }

        this.lastCommand = cleaned;

        // If mock mode or not connected, emit simulation event
        if (!this.isConnected || !this.port) {
            this.emit('tx', { command: cleaned, mock: true, timestamp: Date.now() });
            this.emit('log', { level: 'info', message: `[SIMULATOR TX] ${cleaned}` });
            return { success: true, mock: true, command: cleaned };
        }

        try {
            const textEncoder = new TextEncoder();
            const writer = this.port.writable.getWriter();
            await writer.write(textEncoder.encode(cleaned + '\n'));
            writer.releaseLock();

            this.emit('tx', { command: cleaned, mock: false, timestamp: Date.now() });
            this.emit('log', { level: 'success', message: `[ESP32 TX] ${cleaned}` });
            return { success: true, mock: false, command: cleaned };
        } catch (err) {
            this.emit('error', { message: 'ส่งข้อมูลล้มเหลว: ' + err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Disconnect Port
     */
    async disconnect() {
        this.handleDisconnect();
    }

    async handleDisconnect() {
        this.isConnected = false;
        this.isConnecting = false;

        if (this.reader) {
            try { await this.reader.cancel(); } catch(e){}
            this.reader = null;
        }

        if (this.port) {
            try { await this.port.close(); } catch(e){}
            this.port = null;
        }

        this.emit('status', { connected: false, message: 'ตัดการเชื่อมต่อเรียบร้อยแล้ว' });
    }
}

// Attach to global window in browser
if (typeof window !== 'undefined') {
    window.ESP32SerialManager = ESP32SerialManager;
    window.esp32Serial = new ESP32SerialManager();
}

// CommonJS export for automated Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ESP32SerialManager };
}
