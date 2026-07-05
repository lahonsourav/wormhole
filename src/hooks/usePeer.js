import { useEffect, useCallback, useRef, useState } from 'react';
import PeerConnection from '../webrtc/peerConnection';
import SignalingService from '../webrtc/signalingService';
import { encrypt, decrypt } from '../crypto/encryptor';
import { saveMessage, updateMessageStatus } from '../storage/messageStore';
import { enqueue, flush } from '../storage/pendingQueue';

const makeId = () => Date.now().toString() + Math.random().toString(36).slice(2);

export const usePeer = ({ myKeys, peerPublicKey, roomId, isInitiator, onNewMessage, onCallSignal }) => {
  const reconnectTimer = useRef(null);
  const retryDelay = useRef(5000);
  const [isConnected, setIsConnected] = useState(false);

  // Keep the latest handler without retriggering the connection effect
  const callSignalRef = useRef(onCallSignal);
  callSignalRef.current = onCallSignal;

  const sendMessage = useCallback(async (text) => {
    const msg = {
      id: makeId(),
      text,
      kind: 'text',
      from_peer: 0,
      status: 'pending',
      timestamp: Date.now(),
    };

    await saveMessage(msg);

    // Wake iOS peer before sending
    SignalingService.wakePeer();

    // Give PushKit wake time to establish WebRTC
    await new Promise(resolve => setTimeout(resolve, 1500));

    const payload = encrypt(text, peerPublicKey, myKeys.secretKey);
    const wire = JSON.stringify({ ...payload, id: msg.id, ts: msg.timestamp });

    const sent = PeerConnection.send(wire);

    if (sent) {
      await updateMessageStatus(msg.id, 'sent');
      return { ...msg, status: 'sent' };
    } else {
      await enqueue(msg);
      return msg;
    }
  }, [myKeys, peerPublicKey]);

  // Encrypts {mime, data} as one payload, then ships it in transport-level
  // chunks. Images are not queued for offline retry — they stay 'pending'.
  const sendImage = useCallback(async ({ mime, data }) => {
    const msg = {
      id: makeId(),
      text: `data:${mime};base64,${data}`,
      kind: 'image',
      from_peer: 0,
      status: 'pending',
      timestamp: Date.now(),
    };

    await saveMessage(msg);

    const payload = encrypt(
      JSON.stringify({ mime, data }),
      peerPublicKey,
      myKeys.secretKey
    );
    const wire = JSON.stringify({ ...payload, id: msg.id, ts: msg.timestamp, k: 'i' });

    const sent = await PeerConnection.sendLarge(wire);

    if (sent) {
      await updateMessageStatus(msg.id, 'sent');
      return { ...msg, status: 'sent' };
    }
    return msg;
  }, [myKeys, peerPublicKey]);

  const attemptReconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(async () => {
      try {
        await PeerConnection.init(isInitiator, SignalingService);
      } catch {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        attemptReconnect();
      }
    }, retryDelay.current);
  }, [isInitiator]);

  useEffect(() => {
    if (!myKeys || !peerPublicKey || !roomId) return;

    SignalingService.connect(roomId, {
      onPeerJoined: () => PeerConnection.init(isInitiator, SignalingService),
      onOffer:      (o) => PeerConnection.handleOffer(o, SignalingService),
      onAnswer:     (a) => PeerConnection.handleAnswer(a),
      onCandidate:  (c) => PeerConnection.handleCandidate(c),
      onPeerOffline: () => setIsConnected(false),
    });

    PeerConnection.onCallSignal = (signal) => callSignalRef.current?.(signal);

    PeerConnection.onMessage = async (raw) => {
      try {
        const payload = JSON.parse(raw);

        // Handle ACK messages
        if (payload.type === 'ack') {
          await updateMessageStatus(payload.id, 'delivered');
          onNewMessage({ type: 'ack', id: payload.id });
          return;
        }

        const plain = decrypt(payload, peerPublicKey, myKeys.secretKey);

        let msg;
        if (payload.k === 'i') {
          const img = JSON.parse(plain);
          msg = {
            id: payload.id,
            text: `data:${img.mime};base64,${img.data}`,
            kind: 'image',
            from_peer: 1,
            status: 'received',
            timestamp: payload.ts,
          };
        } else {
          msg = {
            id: payload.id,
            text: plain,
            kind: 'text',
            from_peer: 1,
            status: 'received',
            timestamp: payload.ts,
          };
        }
        await saveMessage(msg);
        onNewMessage(msg);
        // Send delivery ACK
        PeerConnection.send(JSON.stringify({ type: 'ack', id: payload.id }));
      } catch (err) {
        console.error('Failed to handle incoming message:', err.message);
      }
    };

    PeerConnection.onConnected = async () => {
      setIsConnected(true);
      retryDelay.current = 5000;
      clearTimeout(reconnectTimer.current);
      await flush(async (text) => {
        const payload = encrypt(text, peerPublicKey, myKeys.secretKey);
        const wire = JSON.stringify({ nonce: payload.nonce, ciphertext: payload.ciphertext, id: Date.now().toString(), ts: Date.now() });
        return PeerConnection.send(wire);
      });
    };

    PeerConnection.onDisconnected = () => {
      setIsConnected(false);
      attemptReconnect();
    };

    PeerConnection.init(isInitiator, SignalingService).catch(console.error);

    return () => {
      clearTimeout(reconnectTimer.current);
      PeerConnection.onCallSignal = null;
      PeerConnection.close();
      SignalingService.disconnect();
    };
  }, [myKeys, peerPublicKey, roomId]);

  return { sendMessage, sendImage, isConnected };
};
