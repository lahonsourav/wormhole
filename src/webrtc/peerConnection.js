import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';

// Metered.ca TURN relay — fallback for NAT pairings STUN alone can't punch
// through (common with mobile-carrier symmetric/CGNAT).
const TURN_USER = '55610c87b35bc771bb517f8b';
const TURN_CRED = 'N0v7gstg0fy3Vcee';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80', username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:global.relay.metered.ca:443', username: TURN_USER, credential: TURN_CRED },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: TURN_USER, credential: TURN_CRED },
  ],
  bundlePolicy: 'max-bundle',
};

// SCTP caps individual data channel messages; anything bigger than this goes
// out as {type:'chunk'} frames and is reassembled transparently on receive.
const CHUNK_SIZE = 15000;
const MAX_BUFFERED = 4 * 1024 * 1024;

class PeerConnection {
  constructor() {
    this.pc = null;
    this.channel = null;
    this.onMessage = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onCallSignal = null;
    this.onRemoteStream = null;
    this.localStream = null;
    this.remoteStream = null;
    this._rxChunks = {};
  }

  async init(isInitiator, signalingService) {
    if (this.pc) {
      this.close();
    }
    this._rxChunks = {};

    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const type = candidate.candidate?.match(/ typ (\w+)/)?.[1];
        console.log('[webrtc] local candidate:', type || candidate.candidate);
        signalingService.sendCandidate(candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('[webrtc] connectionState:', state);
      if (state === 'connected') this.onConnected?.();
      if (state === 'disconnected' || state === 'failed') this.onDisconnected?.();
    };

    this.pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0];
      if (stream) {
        this.remoteStream = stream;
        this.onRemoteStream?.(stream);
      }
    };

    if (isInitiator) {
      this.channel = this.pc.createDataChannel('chat', { ordered: true });
      this._bindChannel(this.channel);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      signalingService.sendOffer(offer);
    } else {
      this.pc.ondatachannel = ({ channel }) => {
        this.channel = channel;
        this._bindChannel(channel);
      };
    }
  }

  _bindChannel(channel) {
    channel.onopen = () => this.onConnected?.();
    channel.onclose = () => this.onDisconnected?.();
    channel.onmessage = ({ data }) => this._route(data);
  }

  // Transport-level dispatch: chunk reassembly, call signals and in-call SDP
  // renegotiation are handled here; everything else goes up to the app layer.
  _route(data) {
    let p = null;
    try {
      p = JSON.parse(data);
    } catch {
      // not JSON — fall through to app layer
    }
    if (p && p.type === 'chunk') {
      const full = this._receiveChunk(p);
      if (full) this.onMessage?.(full);
      return;
    }
    if (p && p.type === 'call') {
      this.onCallSignal?.(p);
      return;
    }
    if (p && p.type === 'sdp-offer') {
      this._answerRenegotiation(p.sdp).catch((e) =>
        console.error('[webrtc] renegotiation answer failed:', e.message));
      return;
    }
    if (p && p.type === 'sdp-answer') {
      this.pc?.setRemoteDescription(new RTCSessionDescription(p.sdp)).catch((e) =>
        console.error('[webrtc] sdp-answer failed:', e.message));
      return;
    }
    this.onMessage?.(data);
  }

  _receiveChunk({ cid, seq, total, part }) {
    const buf = this._rxChunks[cid] ||
      (this._rxChunks[cid] = { parts: new Array(total), got: 0 });
    if (buf.parts[seq] == null) {
      buf.parts[seq] = part;
      buf.got++;
    }
    if (buf.got === total) {
      delete this._rxChunks[cid];
      return buf.parts.join('');
    }
    return null;
  }

  send(data) {
    if (this.channel?.readyState === 'open') {
      this.channel.send(data);
      return true;
    }
    return false;
  }

  // Send a wire string of any size, chunking when needed. Returns true only
  // if every frame was handed to the channel.
  async sendLarge(wire) {
    if (this.channel?.readyState !== 'open') return false;
    if (wire.length <= CHUNK_SIZE) {
      this.channel.send(wire);
      return true;
    }
    const cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const total = Math.ceil(wire.length / CHUNK_SIZE);
    for (let seq = 0; seq < total; seq++) {
      // Don't overrun the SCTP send buffer on big payloads
      while ((this.channel?.bufferedAmount || 0) > MAX_BUFFERED) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.channel?.readyState !== 'open') return false;
      this.channel.send(JSON.stringify({
        type: 'chunk',
        cid,
        seq,
        total,
        part: wire.slice(seq * CHUNK_SIZE, (seq + 1) * CHUNK_SIZE),
      }));
      if (seq % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }
    return true;
  }

  isOpen() {
    return this.channel?.readyState === 'open';
  }

  // ---- Calls ----

  sendCallSignal(action, video = false) {
    if (this.channel?.readyState !== 'open') return false;
    this.channel.send(JSON.stringify({ type: 'call', action, video }));
    return true;
  }

  async startMedia(withVideo) {
    if (!this.pc) throw new Error('Not connected to peer');
    if (this.localStream) return this.localStream;
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
        ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 }
        : false,
    });
    this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));
    return this.localStream;
  }

  stopMedia() {
    this.localStream?.getTracks().forEach((t) => {
      try { t.stop(); } catch {}
    });
    try {
      this.pc?.getSenders?.().forEach((s) => {
        try { this.pc.removeTrack(s); } catch {}
      });
    } catch {}
    this.localStream = null;
    this.remoteStream = null;
  }

  // Caller side: after the callee accepts, push the media m-lines to the peer
  // over the data channel (the original signaling socket is not needed thanks
  // to max-bundle — no new ICE candidates are required).
  async sendRenegotiationOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.channel?.send(JSON.stringify({
      type: 'sdp-offer',
      sdp: { type: offer.type, sdp: offer.sdp },
    }));
  }

  async _answerRenegotiation(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.channel?.send(JSON.stringify({
      type: 'sdp-answer',
      sdp: { type: answer.type, sdp: answer.sdp },
    }));
  }

  // ---- Initial signaling (over the socket server) ----

  async handleOffer(offer, signalingService) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    signalingService.sendAnswer(answer);
  }

  async handleAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleCandidate(candidate) {
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  close() {
    this.stopMedia();
    this.channel?.close();
    this.pc?.close();
    this.pc = null;
    this.channel = null;
    this._rxChunks = {};
  }
}

export default new PeerConnection();
