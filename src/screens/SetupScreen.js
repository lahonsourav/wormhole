import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { initKeys, saveRoomId, getSavedRoomId } from '../crypto/keyManager';

const SetupScreen = ({ navigation }) => {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInitiator, setIsInitiator] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initKeys();
      const saved = await getSavedRoomId();
      if (saved) {
        setRoomId(saved);
      }
      setLoading(false);
    };
    init().catch(console.error);
  }, []);

  const handleJoin = async () => {
    const trimmed = roomId.trim();
    if (!trimmed) {
      Alert.alert('Room ID required', 'Enter a shared room ID to connect with your peer.');
      return;
    }
    await saveRoomId(trimmed);
    navigation.navigate('Chat', { roomId: trimmed, isInitiator });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0084FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wormhole</Text>
      <Text style={styles.subtitle}>A private tunnel between two devices. No servers in between.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Shared Room ID</Text>
        <TextInput
          style={styles.input}
          value={roomId}
          onChangeText={setRoomId}
          placeholder="e.g. fluffy-panda-42"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Share this ID with your peer. Both of you enter the same ID.
        </Text>

        <Text style={styles.label}>Role</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, isInitiator && styles.roleBtnActive]}
            onPress={() => setIsInitiator(true)}
          >
            <Text style={[styles.roleBtnText, isInitiator && styles.roleBtnTextActive]}>
              Initiator
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, !isInitiator && styles.roleBtnActive]}
            onPress={() => setIsInitiator(false)}
          >
            <Text style={[styles.roleBtnText, !isInitiator && styles.roleBtnTextActive]}>
              Receiver
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>One person picks Initiator, the other Receiver.</Text>
      </View>

      <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
        <Text style={styles.joinBtnText}>Connect</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.verifyBtn} onPress={() => navigation.navigate('Verify')}>
        <Text style={styles.verifyBtnText}>Verify peer key (QR scan)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 24,
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F8F8F8',
  },
  hint: { fontSize: 12, color: '#999', marginTop: 6 },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  roleBtnActive: { borderColor: '#0084FF', backgroundColor: '#E8F4FF' },
  roleBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
  roleBtnTextActive: { color: '#0084FF' },
  joinBtn: {
    backgroundColor: '#0084FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  verifyBtn: { alignItems: 'center', padding: 12 },
  verifyBtnText: { color: '#0084FF', fontSize: 15 },
});

export default SetupScreen;
