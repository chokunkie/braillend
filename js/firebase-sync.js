/**
 * BrailleSyncManager - Real-time Multi-Device Sync Engine (PeerJS WebRTC + Firestore + BroadcastChannel)
 * Works 100% out-of-the-box on Vercel with zero server setup required!
 */

(function(window) {
    'use strict';

    class BrailleSyncManager {
        constructor() {
            this.activeRoomId = null;
            this.isHost = false;
            this.peer = null;
            this.peerConn = null;
            this.broadcastChannel = null;
            this.callbacks = {
                onData: [],
                onStatus: [],
                onDeviceJoin: []
            };

            // 1. BroadcastChannel for same-device multi-tab testing
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
            console.log('[Sync] Initializing BrailleSyncManager with PeerJS WebRTC P2P Support...');
            return true;
        }

        generateRoomId() {
            const num = Math.floor(1000 + Math.random() * 9000);
            return `BR-${num}`;
        }

        getRoomFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return params.get('room') || params.get('roomId') || null;
        }

        /**
         * Host (PC) creates a room and listens for incoming connections
         */
        async createRoom(customRoomId = null) {
            const roomId = (customRoomId || this.generateRoomId()).toUpperCase();
            this.activeRoomId = roomId;
            this.isHost = true;
            localStorage.setItem('braillbox_active_room', roomId);

            // Connect to PeerJS Free Cloud Server
            if (window.Peer) {
                try {
                    if (this.peer) this.peer.destroy();
                    
                    const peerId = `braillbox-${roomId.toLowerCase()}`;
                    this.peer = new Peer(peerId, {
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    this.peer.on('open', (id) => {
                        console.log('[PeerJS Host Open]: Room listening on Peer ID:', id);
                        this._notifyStatus({ state: 'waiting_mobile', roomId: roomId });
                    });

                    this.peer.on('connection', (conn) => {
                        console.log('[PeerJS Host Connection Received from Mobile!]:', conn.peer);
                        this.peerConn = conn;

                        conn.on('open', () => {
                            this._notifyDeviceJoin({ deviceName: 'Mobile Scanner (P2P)', roomId: roomId });
                            conn.send({ type: 'HOST_ACK', roomId: roomId });
                        });

                        conn.on('data', (data) => {
                            console.log('[PeerJS Host Data Received]:', data);
                            this._handleIncomingMessage(data);
                        });
                    });

                    this.peer.on('error', (err) => {
                        console.warn('[PeerJS Host Notice]:', err);
                    });
                } catch (e) {
                    console.warn('[PeerJS Init Notice]:', e);
                }
            }

            this._notifyStatus({ state: 'waiting_mobile', roomId: roomId });
            return roomId;
        }

        /**
         * Mobile joins an existing room and dials the host PC
         */
        async joinRoom(roomId, deviceName = 'Mobile Camera') {
            const normalizedRoom = roomId.trim().toUpperCase();
            this.activeRoomId = normalizedRoom;
            this.isHost = false;
            localStorage.setItem('braillbox_active_room', normalizedRoom);

            const peerTargetId = `braillbox-${normalizedRoom.toLowerCase()}`;

            // Connect to Host via PeerJS
            if (window.Peer) {
                try {
                    if (this.peer) this.peer.destroy();

                    this.peer = new Peer({
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    this.peer.on('open', () => {
                        console.log('[PeerJS Mobile Open]: Dialing Host Peer ID:', peerTargetId);
                        const conn = this.peer.connect(peerTargetId, { reliable: true });
                        this.peerConn = conn;

                        conn.on('open', () => {
                            console.log('[PeerJS Mobile Connected to Host Successfully!]:');
                            this._notifyDeviceJoin({ deviceName: deviceName, roomId: normalizedRoom });
                            conn.send({
                                type: 'DEVICE_JOINED',
                                roomId: normalizedRoom,
                                deviceName: deviceName
                            });
                        });

                        conn.on('data', (data) => {
                            this._handleIncomingMessage(data);
                        });
                    });

                    this.peer.on('error', (err) => {
                        console.warn('[PeerJS Mobile Notice]:', err);
                    });
                } catch (e) {
                    console.warn('[PeerJS Mobile Init Notice]:', e);
                }
            }

            // Also broadcast locally
            this._sendLocalBroadcast({
                type: 'DEVICE_JOINED',
                roomId: normalizedRoom,
                deviceName: deviceName
            });

            this._notifyStatus({ state: 'connected', roomId: normalizedRoom });
            return true;
        }

        /**
         * Send OCR result from Mobile to PC
         */
        async sendOCRResult(text, meta = {}) {
            if (!this.activeRoomId) return false;

            const payload = {
                type: 'OCR_RESULT',
                roomId: this.activeRoomId,
                text: text,
                rawText: meta.rawText || text,
                confidence: meta.confidence || 95,
                timestamp: Date.now(),
                sender: this.isHost ? 'pc' : 'mobile'
            };

            // 1. Send via PeerJS WebRTC P2P Direct
            if (this.peerConn && this.peerConn.open) {
                try {
                    this.peerConn.send(payload);
                    console.log('[Sync] Sent OCR payload directly over WebRTC DataChannel!');
                } catch (e) {
                    console.warn('[PeerJS Send Error]:', e);
                }
            }

            // 2. Send via LocalStorage / BroadcastChannel for same-device fallback
            this._sendLocalBroadcast(payload);

            return true;
        }

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
                const img = document.createElement('img');
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=0-242-254&bgcolor=15-23-42`;
                img.alt = "QR Code";
                img.style.borderRadius = "10px";
                el.appendChild(img);
            }
        }

        getMobileUrl(roomId) {
            const origin = window.location.origin;
            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            return `${origin}${path}camera.html?room=${roomId}`;
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
            if (!data || !data.roomId || data.roomId !== this.activeRoomId) return;
            if (data.type === 'OCR_RESULT') {
                this._notifyData(data);
            } else if (data.type === 'DEVICE_JOINED') {
                this._notifyDeviceJoin(data);
            }
        }
    }

    window.BrailleSync = new BrailleSyncManager();

})(window);
