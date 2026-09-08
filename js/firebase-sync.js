/**
 * BrailleSyncManager - Zero-Config Auto-Connect Real-Time Sync Engine
 * Seamlessly connects Mobile Camera and PC Display automatically with zero room codes needed!
 */

(function(window) {
    'use strict';

    const GLOBAL_ROOM_ID = 'BRAILBOX-MAIN';

    class BrailleSyncManager {
        constructor() {
            this.activeRoomId = GLOBAL_ROOM_ID;
            this.isHost = false;
            this.peer = null;
            this.connections = [];
            this.broadcastChannel = null;
            this.callbacks = {
                onData: [],
                onStatus: [],
                onDeviceJoin: []
            };

            // 1. BroadcastChannel for local cross-tab sync
            if ('BroadcastChannel' in window) {
                try {
                    this.broadcastChannel = new BroadcastChannel('braillbox_realtime_sync');
                    this.broadcastChannel.onmessage = (event) => {
                        this._handleIncomingMessage(event.data);
                    };
                } catch (e) {}
            }

            // 2. Storage event fallback
            window.addEventListener('storage', (e) => {
                if (e.key === 'braillbox_local_sync_event' && e.newValue) {
                    try {
                        const data = JSON.parse(e.newValue);
                        this._handleIncomingMessage(data);
                    } catch (err) {}
                }
            });
        }

        async init() {
            console.log('[Sync] Auto-connecting to Global Channel:', this.activeRoomId);
            return true;
        }

        generateRoomId() {
            const num = Math.floor(1000 + Math.random() * 9000);
            return `BR-${num}`;
        }

        getRoomFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return params.get('room') || params.get('roomId') || GLOBAL_ROOM_ID;
        }

        /**
         * Host (PC) automatically hosts the global channel
         */
        async createRoom(roomId = GLOBAL_ROOM_ID) {
            this.activeRoomId = (roomId || GLOBAL_ROOM_ID).toUpperCase();
            this.isHost = true;
            this._setupPeerServer(true);
            this._notifyStatus({ state: 'connected', roomId: this.activeRoomId });
            return this.activeRoomId;
        }

        /**
         * Mobile automatically joins the global channel
         */
        async joinRoom(roomId = GLOBAL_ROOM_ID, deviceName = 'Mobile Camera') {
            this.activeRoomId = (roomId || GLOBAL_ROOM_ID).toUpperCase();
            this.isHost = false;
            this._setupPeerServer(false, deviceName);
            this._notifyStatus({ state: 'connected', roomId: this.activeRoomId });
            return true;
        }

        _setupPeerServer(isHost, deviceName = 'Mobile') {
            if (!window.Peer) return;

            try {
                if (this.peer) this.peer.destroy();

                const peerHostId = `braillbox-host-${this.activeRoomId.toLowerCase()}`;

                if (isHost) {
                    this.peer = new Peer(peerHostId, {
                        debug: 0,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    this.peer.on('open', (id) => {
                        console.log('[PeerJS Host]: Ready to receive mobile OCR text on:', id);
                    });

                    this.peer.on('connection', (conn) => {
                        console.log('[PeerJS Host]: Mobile connected!');
                        this.connections.push(conn);

                        conn.on('open', () => {
                            this._notifyDeviceJoin({ deviceName: 'Mobile Phone', roomId: this.activeRoomId });
                            conn.send({ type: 'HOST_ACK', roomId: this.activeRoomId });
                        });

                        conn.on('data', (data) => {
                            console.log('[PeerJS Host Received Data]:', data);
                            this._handleIncomingMessage(data);
                        });
                    });

                } else {
                    this.peer = new Peer({
                        debug: 0,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    this.peer.on('open', () => {
                        console.log('[PeerJS Mobile]: Dialing Host at:', peerHostId);
                        const conn = this.peer.connect(peerHostId, { reliable: true });

                        conn.on('open', () => {
                            console.log('[PeerJS Mobile]: Connected to PC successfully!');
                            this.connections.push(conn);
                            this._notifyDeviceJoin({ deviceName: deviceName, roomId: this.activeRoomId });
                            conn.send({
                                type: 'DEVICE_JOINED',
                                roomId: this.activeRoomId,
                                deviceName: deviceName
                            });
                        });

                        conn.on('data', (data) => {
                            this._handleIncomingMessage(data);
                        });
                    });
                }

                this.peer.on('error', (err) => {
                    setTimeout(() => {
                        if (!this.peer || this.peer.destroyed) {
                            this._setupPeerServer(isHost, deviceName);
                        }
                    }, 3000);
                });

            } catch (e) {
                console.warn('[PeerJS Setup Warning]:', e);
            }
        }

        /**
         * Send OCR result from Mobile to PC
         */
        async sendOCRResult(text, meta = {}) {
            const payload = {
                type: 'OCR_RESULT',
                roomId: this.activeRoomId,
                text: text,
                rawText: meta.rawText || text,
                confidence: meta.confidence || 95,
                timestamp: Date.now(),
                sender: this.isHost ? 'pc' : 'mobile'
            };

            // 1. Send to all connected WebRTC peers
            this.connections.forEach(conn => {
                if (conn && conn.open) {
                    try {
                        conn.send(payload);
                        console.log('[Sync] Sent OCR payload over P2P DataChannel!');
                    } catch (err) {}
                }
            });

            // 2. Send via Local BroadcastChannel & LocalStorage fallback
            this._sendLocalBroadcast(payload);

            return true;
        }

        renderQRCode(targetElement, url, size = 180) {
            const el = typeof targetElement === 'string' ? document.getElementById(targetElement) : targetElement;
            if (!el) return;
            el.innerHTML = '';

            const qrUrl = url || this.getMobileUrl();

            if (window.QRCode) {
                new QRCode(el, {
                    text: qrUrl,
                    width: size,
                    height: size,
                    colorDark: "#0f172a",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                const img = document.createElement('img');
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrUrl)}&color=0-242-254&bgcolor=15-23-42`;
                img.alt = "QR Code";
                img.style.borderRadius = "10px";
                el.appendChild(img);
            }
        }

        getMobileUrl(roomId = null) {
            const origin = window.location.origin;
            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            return roomId ? `${origin}${path}camera.html?room=${roomId}` : `${origin}${path}camera.html`;
        }

        onData(cb) { this.callbacks.onData.push(cb); }
        onStatus(cb) { this.callbacks.onStatus.push(cb); }
        onDeviceJoin(cb) { this.callbacks.onDeviceJoin.push(cb); }

        _notifyData(payload) { this.callbacks.onData.forEach(cb => cb(payload)); }
        _notifyStatus(status) { this.callbacks.onStatus.forEach(cb => cb(status)); }
        _notifyDeviceJoin(info) { this.callbacks.onDeviceJoin.forEach(cb => cb(info)); }

        _sendLocalBroadcast(msg) {
            if (this.broadcastChannel) {
                try { this.broadcastChannel.postMessage(msg); } catch (e) {}
            }
            try {
                localStorage.setItem('braillbox_local_sync_event', JSON.stringify({
                    ...msg,
                    _rnd: Math.random()
                }));
            } catch (e) {}
        }

        _handleIncomingMessage(data) {
            if (!data) return;
            if (data.type === 'OCR_RESULT') {
                this._notifyData(data);
            } else if (data.type === 'DEVICE_JOINED') {
                this._notifyDeviceJoin(data);
            }
        }
    }

    window.BrailleSync = new BrailleSyncManager();

})(window);
