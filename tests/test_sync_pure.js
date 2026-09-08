/**
 * Pure Node.js Automated Verification for BrailleSyncManager Logic
 */
const fs = require('fs');

class MockLocalStorage {
    constructor() { this.store = {}; }
    getItem(key) { return this.store[key] || null; }
    setItem(key, val) { this.store[key] = String(val); }
    removeItem(key) { delete this.store[key]; }
}

const mockWindow = {
    localStorage: new MockLocalStorage(),
    location: { origin: 'https://braillbox.vercel.app', pathname: '/index.html', search: '?room=BR-9081' },
    addEventListener: () => {},
    QRCode: null
};

// Evaluate the script in mock environment
const code = fs.readFileSync('js/firebase-sync.js', 'utf8');
const fn = new Function('window', 'localStorage', code);
fn(mockWindow, mockWindow.localStorage);

const Sync = mockWindow.BrailleSync;

console.log('[TEST] Checking BrailleSync instance...');
if (!Sync) throw new Error('BrailleSync instance not created');

console.log('[TEST] Checking Room Code generation...');
const code1 = Sync.generateRoomId();
console.log('  Generated Room ID:', code1);
if (!code1.startsWith('BR-')) throw new Error('Invalid room ID format');

console.log('[TEST] Checking URL query room parsing...');
const parsed = Sync.getRoomFromUrl();
console.log('  Parsed from URL:', parsed);
if (parsed !== 'BR-9081') throw new Error('Failed to parse room from URL');

console.log('[TEST] Checking Mobile URL generation...');
const mobileUrl = Sync.getMobileUrl('BR-5555');
console.log('  Mobile URL:', mobileUrl);
if (!mobileUrl.includes('camera.html?room=BR-5555')) throw new Error('Invalid mobile URL format');

console.log('[TEST] Checking Room Creation & Subscription...');
Sync.createRoom('BR-5555');

let testPassed = false;
Sync.onData((payload) => {
    console.log('  Received OCR Payload:', payload);
    if (payload.text === 'สวัสดีภาษาไทย' && payload.confidence === 95) {
        testPassed = true;
    }
});

// Trigger data event
Sync._notifyData({
    type: 'OCR_RESULT',
    roomId: 'BR-5555',
    text: 'สวัสดีภาษาไทย',
    confidence: 95,
    sender: 'mobile',
    timestamp: Date.now()
});

if (testPassed) {
    console.log('✅ [TEST PASS] All BrailleSyncManager Core Unit Tests Passed 100%!');
} else {
    throw new Error('Callback verification failed');
}
