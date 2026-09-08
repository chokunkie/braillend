/**
 * BrailleSyncManager - Real-time Multi-Device Sync Engine
 * Enables seamless sync between Mobile OCR Scanner and PC Display via Firebase Firestore
 * Fallbacks to BroadcastChannel/LocalStorage for local multi-tab development & testing
 */

(function(window) {
    'use strict';

    const DEFAULT_CONFIG_KEY = 'braillbox_firebase_config';
    const DEFAULT_ROOM_KEY = 'braillbox_active_room';

    class BrailleSyncManager {
        constructor() {
            this.db = null;
            this.app = null;
            this.activeRoomId = null;
            this.isHost = false;
            this.unsubscribeSnapshot = null;
            this.broadcastChannel = null;
            this.callbacks = {
                onData: [],
                onStatus: [],
                onDeviceJoin: []
            };

            // Setup BroadcastChannel for zero-latency local multi-tab preview
            if ('BroadcastChannel' in window) {
                try {
                    this.broadcastChannel = new BroadcastChannel('braillbox_realtime_sync');
                    this.broadcastChannel.onmessage = (event) => {
                        this._handleBroadcastMessage(event.data);
                    };
                } catch (e) {
                    console.warn('[Sync] BroadcastChannel not available:', e);
                }
            }

            // Storage event fallback for cross-tab sync
            window.addEventListener('storage', (e) => {
                if (e.key === 'braillbox_local_sync_event' && e.newValue) {
                    try {
                        const data = JSON.parse(e.newValue);
                        this._handleBroadcastMessage(data);
                    } catch (err) {}
                }
            });
        }

        /**
         * Initialize Firebase Firestore
         * @param {Object} [customConfig] 
         */
        async init(customConfig = null) {
            const config = customConfig || this.getConfig();
            
            if (window.firebase && config && config.apiKey && config.projectId) {
                try {
                    if (!firebase.apps.length) {
                        this.app = firebase.initializeApp(config);
                    } else {
                        this.app = firebase.app();
                    }
                    this.db = firebase.firestore();
                    console.log('[Sync] Firebase Firestore initialized successfully for project:', config.projectId);
                    return true;
                } catch (error) {
                    console.warn('[Sync] Firebase init warning:', error.message);
                }
            } else {
                console.log('[Sync] Running in Local BroadcastChannel / Standalone Sync Mode');
            }
            return false;
        }

        /**
         * Save Firebase Config to LocalStorage
         */
        saveConfig(config) {
            try {
                localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(config));
                return this.init(config);
            } catch (e) {
                console.error('[Sync] Failed to save config:', e);
                return false;
            }
        }

        /**
         * Get saved Firebase Config
         */
        getConfig() {
            try {
                const raw = localStorage.getItem(DEFAULT_CONFIG_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        /**
         * Generate a random 6-character room code (e.g. BR-7824)
         */
        generateRoomId() {
            const num = Math.floor(1000 + Math.random() * 9000);
            return `BR-${num}`;
        }

        /**
         * Get Room ID from current URL query parameters (e.g. ?room=BR-1234)
         */
        getRoomFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return params.get('room') || params.get('roomId') || null;
        }

        /**
         * Host creates a new sync room
         * @param {string} [customRoomId]
         */
        async createRoom(customRoomId = null) {
            const roomId = (customRoomId || this.generateRoomId()).toUpperCase();
            this.activeRoomId = roomId;
            this.isHost = true;
            localStorage.setItem(DEFAULT_ROOM_KEY, roomId);

            const initialData = {
                roomId: roomId,
                createdAt: Date.now(),
                status: 'waiting_mobile',
                hostConnected: true,
                mobileConnected: false,
                lastText: '',
                lastUpdated: Date.now()
            };

            // Firestore sync if configured
            if (this.db) {
                try {
                    await this.db.collection('braille_rooms').doc(roomId).set(initialData);
                } catch (e) {
                    console.warn('[Sync] Firestore createRoom error (will use local fallback):', e);
                }
            }

            // Start listening
            this.listenToRoom(roomId);
            this._notifyStatus({ state: 'waiting_mobile', roomId: roomId });
            return roomId;
        }

        /**
         * Mobile joins an existing room
         * @param {string} roomId 
         * @param {string} [deviceName]
         */
        async joinRoom(roomId, deviceName = 'Mobile Scanner') {
            const normalizedRoom = roomId.trim().toUpperCase();
            this.activeRoomId = normalizedRoom;
            this.isHost = false;
            localStorage.setItem(DEFAULT_ROOM_KEY, normalizedRoom);

            const updateData = {
                mobileConnected: true,
                mobileDevice: deviceName,
                status: 'connected',
                lastJoined: Date.now()
            };

            // Notify via Firestore
            if (this.db) {
                try {
                    await this.db.collection('braille_rooms').doc(normalizedRoom).set(updateData, { merge: true });
                } catch (e) {
                    console.warn('[Sync] Firestore joinRoom error:', e);
                }
            }

            // Notify via BroadcastChannel
            this._sendBroadcast({
                type: 'DEVICE_JOINED',
                roomId: normalizedRoom,
                deviceName: deviceName,
                timestamp: Date.now()
            });

            this.listenToRoom(normalizedRoom);
            this._notifyStatus({ state: 'connected', roomId: normalizedRoom });
            return true;
        }

        /**
         * Send OCR result from Mobile to Host PC
         * @param {string} text Recognized text
         * @param {Object} [meta] Additional metadata like confidence, rawText, imagePreview
         */
        async sendOCRResult(text, meta = {}) {
            if (!this.activeRoomId) {
                console.warn('[Sync] Cannot send OCR result: No active room');
                return false;
            }

            const payload = {
                type: 'OCR_RESULT',
                roomId: this.activeRoomId,
                text: text,
                rawText: meta.rawText || text,
                confidence: meta.confidence || 100,
                imagePreview: meta.imagePreview || null,
                timestamp: Date.now(),
                sender: this.isHost ? 'pc' : 'mobile'
            };

            // 1. Send to Firestore
            if (this.db) {
                try {
                    await this.db.collection('braille_rooms').doc(this.activeRoomId).update({
                        lastText: text,
                        lastPayload: payload,
                        lastUpdated: Date.now(),
                        status: 'text_received'
                    });
                } catch (e) {
                    console.warn('[Sync] Firestore sendOCRResult error:', e);
                }
            }

            // 2. Send to BroadcastChannel / LocalStorage
            this._sendBroadcast(payload);

            return true;
        }

        /**
         * Listen to room updates
         * @param {string} roomId 
         */
        listenToRoom(roomId) {
            if (this.unsubscribeSnapshot) {
                this.unsubscribeSnapshot();
                this.unsubscribeSnapshot = null;
            }

            if (this.db) {
                try {
                    this.unsubscribeSnapshot = this.db.collection('braille_rooms').doc(roomId)
                        .onSnapshot((doc) => {
                            if (doc.exists) {
                                const data = doc.data();
                                if (data.lastPayload && data.lastPayload.type === 'OCR_RESULT') {
                                    this._notifyData(data.lastPayload);
                                }
                                if (data.mobileConnected) {
                                    this._notifyDeviceJoin({ deviceName: data.mobileDevice || 'Mobile Device', roomId: roomId });
                                }
                            }
                        }, (error) => {
                            console.warn('[Sync] Firestore listener error:', error);
                        });
                } catch (e) {
                    console.warn('[Sync] Firestore listenToRoom error:', e);
                }
            }
        }

        /**
         * Render QR Code into DOM container
         * @param {HTMLElement|string} targetElement 
         * @param {string} url 
         * @param {number} [size=180] 
         */
        renderQRCode(targetElement, url, size = 180) {
            const el = typeof targetElement === 'string' ? document.getElementById(targetElement) : targetElement;
            if (!el) return;

            el.innerHTML = '';

            if (window.QRCode) {
                new QRCode(el, {
                    text: url,
                    width: size,
                    height: size,
                    colorDark: "#0f172a",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                // Fallback using public high-res QR API
                const img = document.createElement('img');
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=0-242-254&bgcolor=15-23-42`;
                img.alt = "Scan to Pair Mobile Camera";
                img.style.borderRadius = "10px";
                img.style.boxShadow = "0 8px 24px rgba(0, 242, 254, 0.25)";
                el.appendChild(img);
            }
        }

        /**
         * Get Direct Mobile Scanner URL for QR Code
         */
        getMobileUrl(roomId) {
            const origin = window.location.origin;
            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            return `${origin}${path}camera.html?room=${roomId}`;
        }

        // --- Callbacks & Events ---
        onData(cb) {
            this.callbacks.onData.push(cb);
        }

        onStatus(cb) {
            this.callbacks.onStatus.push(cb);
        }

        onDeviceJoin(cb) {
            this.callbacks.onDeviceJoin.push(cb);
        }

        _notifyData(payload) {
            this.callbacks.onData.forEach(cb => cb(payload));
        }

        _notifyStatus(status) {
            this.callbacks.onStatus.forEach(cb => cb(status));
        }

        _notifyDeviceJoin(info) {
            this.callbacks.onDeviceJoin.forEach(cb => cb(info));
        }

        _sendBroadcast(msg) {
            if (this.broadcastChannel) {
                this.broadcastChannel.postMessage(msg);
            }
            try {
                localStorage.setItem('braillbox_local_sync_event', JSON.stringify({
                    ...msg,
                    _randomKey: Math.random()
                }));
            } catch (e) {}
        }

        _handleBroadcastMessage(data) {
            if (!data || !data.roomId || data.roomId !== this.activeRoomId) return;

            if (data.type === 'OCR_RESULT') {
                this._notifyData(data);
            } else if (data.type === 'DEVICE_JOINED') {
                this._notifyDeviceJoin(data);
            }
        }
    }

    // Export singleton instance to window
    window.BrailleSync = new BrailleSyncManager();

})(window);
