import React, { useCallback, useEffect } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Text, Alert, PermissionsAndroid,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { usePeer } from '../hooks/usePeer';
import { useMessages } from '../hooks/useMessages';
import { useEncryption } from '../hooks/useEncryption';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { usePushKit } from '../hooks/usePushKit';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import ConnectionStatusBar from '../components/ConnectionStatusBar';
import PeerConnection from '../webrtc/peerConnection';
import SignalingService from '../webrtc/signalingService';

const requestMediaPermissions = async (video) => {
  if (Platform.OS !== 'android') return true;
  const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const res = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
};

const ChatScreen = ({ route, navigation }) => {
  const { roomId, isInitiator } = route.params;
  const { myKeys, peerPublicKey } = useEncryption();
  const { messages, addMessage } = useMessages();
  const { isOnline } = useNetworkStatus();

  // Call state machine: this screen stays mounted under CallScreen in the
  // stack, so it keeps receiving signals during a call.
  const handleCallSignal = useCallback(async (signal) => {
    if (signal.action === 'invite') {
      Alert.alert(
        `Incoming ${signal.video ? 'video' : 'voice'} call`,
        'Your peer is calling.',
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => PeerConnection.sendCallSignal('reject'),
          },
          {
            text: 'Accept',
            onPress: async () => {
              const ok = await requestMediaPermissions(signal.video);
              if (!ok) {
                PeerConnection.sendCallSignal('reject');
                return;
              }
              try {
                // Add our tracks BEFORE accepting so they ride along in the
                // answer to the caller's renegotiation offer.
                await PeerConnection.startMedia(signal.video);
                PeerConnection.sendCallSignal('accept', signal.video);
                navigation.navigate('Call', { video: signal.video });
              } catch (e) {
                PeerConnection.sendCallSignal('reject');
                Alert.alert('Call failed', e.message);
              }
            },
          },
        ]
      );
    } else if (signal.action === 'accept') {
      // Callee accepted — push our media m-lines over the data channel
      try {
        await PeerConnection.sendRenegotiationOffer();
      } catch (e) {
        console.error('[call] renegotiation failed:', e.message);
      }
    } else if (signal.action === 'reject') {
      PeerConnection.stopMedia();
      navigation.navigate('Chat', route.params);
      Alert.alert('Call declined');
    } else if (signal.action === 'end') {
      PeerConnection.stopMedia();
      navigation.navigate('Chat', route.params);
    }
  }, [navigation, route.params]);

  const { sendMessage, sendImage, isConnected } = usePeer({
    myKeys,
    peerPublicKey,
    roomId,
    isInitiator,
    onNewMessage: addMessage,
    onCallSignal: handleCallSignal,
  });

  usePushKit({
    onWakeUp: useCallback(() => {
      if (myKeys && peerPublicKey) {
        PeerConnection.init(isInitiator, SignalingService).catch(console.error);
      }
    }, [myKeys, peerPublicKey, isInitiator]),
  });

  const startCall = useCallback(async (video) => {
    const ok = await requestMediaPermissions(video);
    if (!ok) {
      Alert.alert('Permission needed', 'Microphone (and camera) access is required for calls.');
      return;
    }
    try {
      await PeerConnection.startMedia(video);
      PeerConnection.sendCallSignal('invite', video);
      navigation.navigate('Call', { video });
    } catch (e) {
      PeerConnection.stopMedia();
      Alert.alert('Call failed', e.message);
    }
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => startCall(false)}
            disabled={!isConnected}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerIcon, !isConnected && styles.headerIconDisabled]}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => startCall(true)}
            disabled={!isConnected}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerIcon, !isConnected && styles.headerIconDisabled]}>🎥</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isConnected, startCall]);

  const handleSend = useCallback(async (text) => {
    if (!myKeys || !peerPublicKey) return;
    const msg = await sendMessage(text);
    if (msg) addMessage(msg);
  }, [myKeys, peerPublicKey, sendMessage, addMessage]);

  const pickAndSendImage = useCallback(async (useCamera) => {
    try {
      if (useCamera && Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      const launcher = useCamera ? launchCamera : launchImageLibrary;
      const res = await launcher({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.7,
        saveToPhotos: false,
      });
      const asset = res?.assets?.[0];
      if (!asset?.base64) return;
      const msg = await sendImage({
        mime: asset.type || 'image/jpeg',
        data: asset.base64,
      });
      if (msg) addMessage(msg);
    } catch (e) {
      Alert.alert('Image failed', e.message);
    }
  }, [sendImage, addMessage]);

  const handleAttach = useCallback(() => {
    Alert.alert('Send image', 'Choose a source', [
      { text: 'Photo Library', onPress: () => pickAndSendImage(false) },
      { text: 'Camera', onPress: () => pickAndSendImage(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickAndSendImage]);

  const ready = !!myKeys && !!peerPublicKey;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ConnectionStatusBar isConnected={isConnected} isOnline={isOnline} />

      {!peerPublicKey && (
        <View style={styles.noPeerBanner}>
          <Text style={styles.noPeerText}>
            Peer key not set. Scan their QR code first.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Verify')}>
            <Text style={styles.noPeerLink}>Verify Peer</Text>
          </TouchableOpacity>
        </View>
      )}

      <MessageList messages={messages} />

      <MessageInput
        onSend={handleSend}
        onAttach={handleAttach}
        disabled={!ready || !isConnected}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  noPeerBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noPeerText: { flex: 1, fontSize: 13, color: '#856404' },
  noPeerLink: { color: '#0084FF', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  headerIcon: { fontSize: 20 },
  headerIconDisabled: { opacity: 0.35 },
});

export default ChatScreen;
