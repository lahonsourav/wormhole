import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, Platform, TextInput, Clipboard,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { RNCamera } from 'react-native-camera';
import {
  initKeys, storePeerPublicKey, getPeerPublicKey,
  getFingerprint, setPeerVerified,
} from '../crypto/keyManager';
import { getSafetyNumber } from '../crypto/safetyNumber';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const VerifyScreen = ({ navigation }) => {
  const [myKeys, setMyKeys] = useState(null);
  const [peerPublicKey, setPeerPublicKeyState] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [manualKey, setManualKey] = useState('');

  useEffect(() => {
    const load = async () => {
      const keys = await initKeys();
      setMyKeys(keys);
      const peer = await getPeerPublicKey();
      if (peer) {
        setPeerPublicKeyState(peer);
        setSafetyNumber(getSafetyNumber(keys.publicKey, peer));
      }
    };
    load().catch(console.error);
  }, []);

  const handleQRRead = useCallback(async ({ data }) => {
    if (!data || !myKeys) return;
    setScanning(false);

    try {
      const peerKey = decodeBase64(data);
      if (peerKey.length !== 32) throw new Error('Invalid key length');

      await storePeerPublicKey(data);
      setPeerPublicKeyState(peerKey);
      setSafetyNumber(getSafetyNumber(myKeys.publicKey, peerKey));

      Alert.alert(
        'Peer key stored',
        'Compare the Safety Number with your peer to confirm no MITM attack.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Invalid QR code', 'This does not look like a valid public key.');
    }
  }, [myKeys]);

  const handleManualKey = useCallback(async () => {
    if (!manualKey.trim() || !myKeys) return;
    try {
      const peerKey = decodeBase64(manualKey.trim());
      if (peerKey.length !== 32) throw new Error('Invalid key length');
      await storePeerPublicKey(manualKey.trim());
      setPeerPublicKeyState(peerKey);
      setSafetyNumber(getSafetyNumber(myKeys.publicKey, peerKey));
      Alert.alert('Peer key stored', 'Key accepted. Check the Safety Number with your peer.');
    } catch {
      Alert.alert('Invalid key', 'Paste the exact base64 key from the other device.');
    }
  }, [manualKey, myKeys]);

  const handleVerify = async () => {
    await setPeerVerified(true);
    setVerified(true);
    Alert.alert('Verified!', 'Keys verified. Connection is MITM-proof.', [
      { text: 'Go to Chat', onPress: () => navigation.navigate('Setup') },
    ]);
  };

  if (!myKeys) return null;

  const myPublicKeyBase64 = encodeBase64(myKeys.publicKey);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Key Verification</Text>
      <Text style={styles.subtitle}>
        Exchange public keys in person or on a voice call to prevent MITM attacks.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Public Key (show to peer)</Text>
        <View style={styles.qrContainer}>
          <QRCode value={myPublicKeyBase64} size={200} />
        </View>
        <Text style={styles.fingerprint} numberOfLines={2} selectable>
          {getFingerprint(myKeys.publicKey)}
        </Text>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => { Clipboard.setString(myPublicKeyBase64); Alert.alert('Copied', 'Public key copied to clipboard.'); }}
        >
          <Text style={styles.copyBtnText}>Copy My Key</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paste Peer's Key (emulator / manual)</Text>
        <TextInput
          style={styles.keyInput}
          value={manualKey}
          onChangeText={setManualKey}
          placeholder="Paste base64 key here"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <TouchableOpacity style={styles.scanBtn} onPress={handleManualKey}>
          <Text style={styles.scanBtnText}>Use This Key</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan Peer's QR Code</Text>
        {scanning ? (
          <View style={styles.cameraContainer}>
            <RNCamera
              style={styles.camera}
              onBarCodeRead={handleQRRead}
              barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
              captureAudio={false}
            />
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => setScanning(true)}
          >
            <Text style={styles.scanBtnText}>Scan Peer QR</Text>
          </TouchableOpacity>
        )}
      </View>

      {peerPublicKey && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Number</Text>
          <Text style={styles.safetyNote}>
            Read this number aloud on a call with your peer. If they see the same number, you are protected.
          </Text>
          <View style={styles.safetyBox}>
            <Text style={styles.safetyNumber}>{safetyNumber}</Text>
          </View>
          {!verified && (
            <TouchableOpacity style={styles.verifyBtn} onPress={handleVerify}>
              <Text style={styles.verifyBtnText}>Numbers Match — Mark as Verified</Text>
            </TouchableOpacity>
          )}
          {verified && (
            <Text style={styles.verifiedBadge}>Verified</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
  qrContainer: { alignItems: 'center', marginBottom: 12 },
  fingerprint: { fontSize: 12, color: '#666', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cameraContainer: { height: 280, borderRadius: 12, overflow: 'hidden' },
  camera: { flex: 1 },
  cancelBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '600' },
  scanBtn: {
    borderWidth: 2,
    borderColor: '#0084FF',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  scanBtnText: { color: '#0084FF', fontSize: 16, fontWeight: '600' },
  safetyNote: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  safetyBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  safetyNumber: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#1A1A1A',
    letterSpacing: 2,
    lineHeight: 28,
  },
  copyBtn: {
    marginTop: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  copyBtnText: { color: '#0084FF', fontSize: 14, fontWeight: '600' },
  keyInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#1A1A1A',
    backgroundColor: '#F8F8F8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minHeight: 80,
    marginBottom: 12,
  },
  verifyBtn: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  verifyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  verifiedBadge: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

export default VerifyScreen;
