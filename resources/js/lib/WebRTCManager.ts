import axios from 'axios';

/**
 * WebRTCManager — handles peer-to-peer audio calls in the meeting room.
 *
 * Topology: Full mesh (each peer connects to every other peer).
 * Signaling: Via backend polling (cache-based).
 *
 * Use cases:
 * - Up to 4 participants (mesh overhead is O(N²) per participant)
 * - Audio only (video could be added later)
 */

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export interface PeerState {
    userId: number;
    name: string;
    connection: RTCPeerConnection;
    stream: MediaStream | null;
    audioEl: HTMLAudioElement | null;
    connectionState: RTCPeerConnectionState;
    isSpeaking: boolean;
    volumeLevel: number; // 0-1
}

export interface WebRTCCallbacks {
    onPeerAdded?: (userId: number, peer: PeerState) => void;
    onPeerRemoved?: (userId: number) => void;
    onPeerUpdated?: (userId: number, peer: PeerState) => void;
    onLocalStream?: (stream: MediaStream) => void;
    onError?: (message: string) => void;
}

export class WebRTCManager {
    private meetingId: number;
    private localUserId: number;
    private localStream: MediaStream | null = null;
    private peers: Map<number, PeerState> = new Map();
    private callbacks: WebRTCCallbacks;
    private signalingInterval?: ReturnType<typeof setInterval>;
    private audioContext: AudioContext | null = null;
    private volumeAnalysers: Map<number, AnalyserNode> = new Map();
    private volumeRAF?: number;
    private isInCall = false;

    constructor(meetingId: number, localUserId: number, callbacks: WebRTCCallbacks = {}) {
        this.meetingId = meetingId;
        this.localUserId = localUserId;
        this.callbacks = callbacks;
    }

    /* ── Join call: capture mic and start signaling ──────────────── */
    async joinCall(): Promise<void> {
        try {
            // Request mic access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            this.callbacks.onLocalStream?.(this.localStream);

            // Set up local volume analyser
            this.setupLocalVolumeAnalyser();

            // Notify server we joined
            const { data } = await axios.post(`/meetings/${this.meetingId}/call/join`);

            this.isInCall = true;

            // Start signaling poll loop
            this.startSignalingPoll();

            // Initiate connections to everyone who's already in the call
            for (const p of (data.participants || [])) {
                if (p.user_id !== this.localUserId) {
                    await this.initiatePeer(p.user_id, p.name);
                }
            }
        } catch (err: any) {
            console.error('Join call failed:', err);
            this.callbacks.onError?.(
                err.name === 'NotAllowedError'
                    ? 'Microphone access denied. Please allow mic access in your browser.'
                    : err.name === 'NotFoundError'
                    ? 'No microphone found. Please connect a mic.'
                    : `Call failed: ${err.message}`
            );
            throw err;
        }
    }

    /* ── Leave call: close all peers, release mic ───────────────── */
    async leaveCall(): Promise<void> {
        this.isInCall = false;

        if (this.signalingInterval) clearInterval(this.signalingInterval);
        if (this.volumeRAF) cancelAnimationFrame(this.volumeRAF);

        // Send "bye" to all peers
        for (const [userId] of this.peers) {
            try {
                await axios.post(`/meetings/${this.meetingId}/call/signal`, {
                    to_user_id: userId, type: 'bye', payload: {},
                });
            } catch {}
        }

        // Close all peer connections
        for (const [userId, peer] of this.peers) {
            peer.connection.close();
            if (peer.audioEl) {
                peer.audioEl.srcObject = null;
                peer.audioEl.remove();
            }
            this.callbacks.onPeerRemoved?.(userId);
        }
        this.peers.clear();
        this.volumeAnalysers.clear();

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        // Notify server
        try { await axios.post(`/meetings/${this.meetingId}/call/leave`); } catch {}
    }

    /* ── Toggle mic mute ────────────────────────────────────────── */
    setMuted(muted: boolean): void {
        if (!this.localStream) return;
        this.localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }

    isMuted(): boolean {
        if (!this.localStream) return true;
        return !this.localStream.getAudioTracks().some(t => t.enabled);
    }

    getPeers(): Map<number, PeerState> {
        return this.peers;
    }

    isActive(): boolean {
        return this.isInCall;
    }

    /* ── Create a peer connection and send an offer ──────────────── */
    private async initiatePeer(userId: number, name: string): Promise<void> {
        if (this.peers.has(userId)) return;

        const pc = this.createPeerConnection(userId, name);
        const peer = this.peers.get(userId)!;

        // Create offer
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);

        // Send offer via signaling
        await axios.post(`/meetings/${this.meetingId}/call/signal`, {
            to_user_id: userId,
            type: 'offer',
            payload: { sdp: pc.localDescription },
        });
    }

    /* ── Create a peer connection object and wire up events ──────── */
    private createPeerConnection(userId: number, name: string): RTCPeerConnection {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add local audio tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await axios.post(`/meetings/${this.meetingId}/call/signal`, {
                        to_user_id: userId,
                        type: 'ice',
                        payload: { candidate: event.candidate.toJSON() },
                    });
                } catch {}
            }
        };

        // Handle remote stream arriving
        pc.ontrack = (event) => {
            const [stream] = event.streams;
            const peer = this.peers.get(userId);
            if (!peer) return;

            peer.stream = stream;

            // Create hidden audio element for playback
            if (!peer.audioEl) {
                const audio = document.createElement('audio');
                audio.autoplay = true;
                audio.srcObject = stream;
                audio.setAttribute('data-peer', String(userId));
                document.body.appendChild(audio);
                peer.audioEl = audio;
            } else {
                peer.audioEl.srcObject = stream;
            }

            // Set up volume analyser for this remote stream
            this.setupRemoteVolumeAnalyser(userId, stream);

            this.callbacks.onPeerUpdated?.(userId, peer);
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            const peer = this.peers.get(userId);
            if (!peer) return;
            peer.connectionState = pc.connectionState;
            this.callbacks.onPeerUpdated?.(userId, peer);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setTimeout(() => {
                    if (this.peers.get(userId)?.connection.connectionState !== 'connected') {
                        this.removePeer(userId);
                    }
                }, 5000);
            }
        };

        const peer: PeerState = {
            userId,
            name,
            connection: pc,
            stream: null,
            audioEl: null,
            connectionState: pc.connectionState,
            isSpeaking: false,
            volumeLevel: 0,
        };

        this.peers.set(userId, peer);
        this.callbacks.onPeerAdded?.(userId, peer);

        return pc;
    }

    /* ── Remove a peer ──────────────────────────────────────────── */
    private removePeer(userId: number): void {
        const peer = this.peers.get(userId);
        if (!peer) return;
        peer.connection.close();
        if (peer.audioEl) {
            peer.audioEl.srcObject = null;
            peer.audioEl.remove();
        }
        this.volumeAnalysers.delete(userId);
        this.peers.delete(userId);
        this.callbacks.onPeerRemoved?.(userId);
    }

    /* ── Poll for signaling messages ────────────────────────────── */
    private startSignalingPoll(): void {
        this.signalingInterval = setInterval(async () => {
            if (!this.isInCall) return;
            try {
                const { data } = await axios.get(`/meetings/${this.meetingId}/call/poll`);
                for (const signal of (data.signals || [])) {
                    await this.handleSignal(signal);
                }

                // Sync call participants: connect to new ones, forget ones who left
                const serverUserIds = new Set<number>((data.call_participants || []).map((p: any) => p.user_id));
                // Remove peers no longer in call
                for (const [userId] of this.peers) {
                    if (!serverUserIds.has(userId)) {
                        this.removePeer(userId);
                    }
                }
            } catch {}
        }, 1500);
    }

    /* ── Handle incoming signaling message ──────────────────────── */
    private async handleSignal(signal: any): Promise<void> {
        const { from_user_id, from_name, type, payload } = signal;

        if (type === 'offer') {
            // New peer wants to connect to us
            let pc: RTCPeerConnection;
            if (!this.peers.has(from_user_id)) {
                pc = this.createPeerConnection(from_user_id, from_name);
            } else {
                pc = this.peers.get(from_user_id)!.connection;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await axios.post(`/meetings/${this.meetingId}/call/signal`, {
                to_user_id: from_user_id,
                type: 'answer',
                payload: { sdp: pc.localDescription },
            });
        } else if (type === 'answer') {
            const peer = this.peers.get(from_user_id);
            if (peer && peer.connection.signalingState !== 'stable') {
                await peer.connection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
        } else if (type === 'ice') {
            const peer = this.peers.get(from_user_id);
            if (peer && payload.candidate) {
                try {
                    await peer.connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
                } catch (e) {
                    console.warn('Failed to add ICE candidate:', e);
                }
            }
        } else if (type === 'bye') {
            this.removePeer(from_user_id);
        }
    }

    /* ── Volume analysis (to detect who's speaking) ──────────────── */
    private setupLocalVolumeAnalyser(): void {
        if (!this.localStream) return;
        try {
            if (!this.audioContext) this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            // Note: we don't connect analyser to destination to avoid local playback
            this.volumeAnalysers.set(this.localUserId, analyser);
            this.startVolumeLoop();
        } catch (e) {
            console.warn('Failed to set up local volume analyser:', e);
        }
    }

    private setupRemoteVolumeAnalyser(userId: number, stream: MediaStream): void {
        try {
            if (!this.audioContext) this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            this.volumeAnalysers.set(userId, analyser);
        } catch (e) {
            console.warn('Failed to set up remote volume analyser:', e);
        }
    }

    private startVolumeLoop(): void {
        const tick = () => {
            if (!this.isInCall) return;
            for (const [userId, analyser] of this.volumeAnalysers) {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((s, v) => s + v, 0) / data.length;
                const level = avg / 128; // 0-1+
                const isSpeaking = level > 0.08;

                if (userId === this.localUserId) {
                    // Update local speaking via callback (could use this for local indicator)
                } else {
                    const peer = this.peers.get(userId);
                    if (peer) {
                        const changed = peer.volumeLevel !== level || peer.isSpeaking !== isSpeaking;
                        peer.volumeLevel = level;
                        peer.isSpeaking = isSpeaking;
                        if (changed) this.callbacks.onPeerUpdated?.(userId, peer);
                    }
                }
            }
            this.volumeRAF = requestAnimationFrame(tick);
        };
        this.volumeRAF = requestAnimationFrame(tick);
    }
}
