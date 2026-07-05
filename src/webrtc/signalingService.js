import { io } from 'socket.io-client';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your deployed signaling server URL (use https:// in production).
// 10.0.2.2 = host machine's localhost as seen from the Android emulator.
// For a physical phone, replace with your PC's LAN IP (e.g. http://192.168.1.x:7788).
// Port 7788: another dev server on this machine occupies 3000 and hops to
// 3001, 3002, ... when its port is busy, so stay well away from that range.
const SIGNALING_URL = process.env.SIGNALING_URL || 'https://wormhole-production-843f.up.railway.app';

class SignalingService {
  constructor() {
    this.socket = null;
  }

  async connect(roomId, callbacks) {
    const iosToken = Platform.OS === 'ios'
      ? await AsyncStorage.getItem('iosVoIPToken')
      : null;

    this.socket = io(SIGNALING_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect_error', (err) => {
      console.log('[signaling] connect_error:', err.message);
    });

    this.socket.on('connect', () => {
      console.log('[signaling] connected:', this.socket.id);
      this.socket.emit('join', {
        roomId,
        platform: Platform.OS,
        iosToken,
      });
    });

    this.socket.on('peer-joined',  callbacks.onPeerJoined);
    this.socket.on('offer',        callbacks.onOffer);
    this.socket.on('answer',       callbacks.onAnswer);
    this.socket.on('candidate',    callbacks.onCandidate);
    this.socket.on('peer-offline', callbacks.onPeerOffline || (() => {}));
  }

  sendOffer(sdp) {
    this.socket?.emit('offer', sdp);
  }

  sendAnswer(sdp) {
    this.socket?.emit('answer', sdp);
  }

  sendCandidate(candidate) {
    this.socket?.emit('candidate', candidate);
  }

  wakePeer() {
    this.socket?.emit('wake-peer');
  }

  updateToken(iosToken) {
    this.socket?.emit('update-token', iosToken);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export default new SignalingService();
