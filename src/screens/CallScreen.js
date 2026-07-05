import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import PeerConnection from '../webrtc/peerConnection';

// Pure call UI over the PeerConnection singleton. Call state transitions
// (invite/accept/end signals) are handled by ChatScreen, which stays mounted
// underneath this screen in the stack.
const CallScreen = ({ route, navigation }) => {
  const { video } = route.params || {};
  const [localStream, setLocalStream] = useState(PeerConnection.localStream);
  const [remoteStream, setRemoteStream] = useState(PeerConnection.remoteStream);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    setLocalStream(PeerConnection.localStream);
    setRemoteStream(PeerConnection.remoteStream);
    PeerConnection.onRemoteStream = (s) => setRemoteStream(s);
    return () => {
      PeerConnection.onRemoteStream = null;
    };
  }, []);

  const hangUp = () => {
    PeerConnection.sendCallSignal('end');
    PeerConnection.stopMedia();
    navigation.goBack();
  };

  const toggleMute = () => {
    const next = !muted;
    PeerConnection.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    PeerConnection.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setCameraOff(next);
  };

  const remoteHasVideo = !!remoteStream && remoteStream.getVideoTracks().length > 0;

  return (
    <View style={styles.container}>
      {remoteHasVideo ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={styles.voicePlaceholder}>
          <Text style={styles.voiceIcon}>{video ? '🎥' : '📞'}</Text>
          <Text style={styles.voiceLabel}>
            {remoteStream ? 'Connected' : 'Ringing…'}
          </Text>
        </View>
      )}

      {video && localStream && !cameraOff && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, muted && styles.controlActive]}
          onPress={toggleMute}
        >
          <Text style={styles.controlIcon}>{muted ? '🔇' : '🎤'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
          <Text style={styles.hangUpIcon}>📵</Text>
        </TouchableOpacity>

        {video && (
          <TouchableOpacity
            style={[styles.controlBtn, cameraOff && styles.controlActive]}
            onPress={toggleCamera}
          >
            <Text style={styles.controlIcon}>{cameraOff ? '🚫' : '📷'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  remoteVideo: { flex: 1 },
  voicePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  voiceIcon: { fontSize: 64, marginBottom: 16 },
  voiceLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  localVideo: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333333',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  controlActive: { backgroundColor: 'rgba(255,255,255,0.55)' },
  controlIcon: { fontSize: 24 },
  hangUpBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  hangUpIcon: { fontSize: 28 },
});

export default CallScreen;
