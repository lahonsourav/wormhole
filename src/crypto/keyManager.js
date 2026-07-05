import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYPAIR_KEY = 'keypair';
const PEER_PUB_KEY = 'peerPublicKey';
const PEER_VERIFIED_KEY = 'peerVerified';
const ROOM_ID_KEY = 'roomId';

export const initKeys = async () => {
  const stored = await AsyncStorage.getItem(KEYPAIR_KEY);
  if (stored) {
    const { publicKey, secretKey } = JSON.parse(stored);
    return {
      publicKey: decodeBase64(publicKey),
      secretKey: decodeBase64(secretKey),
    };
  }
  const keyPair = nacl.box.keyPair();
  await AsyncStorage.setItem(KEYPAIR_KEY, JSON.stringify({
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  }));
  return keyPair;
};

export const storePeerPublicKey = async (peerPubKeyBase64) => {
  await AsyncStorage.setItem(PEER_PUB_KEY, peerPubKeyBase64);
};

export const getPeerPublicKey = async () => {
  const raw = await AsyncStorage.getItem(PEER_PUB_KEY);
  return raw ? decodeBase64(raw) : null;
};

export const setPeerVerified = async (verified) => {
  await AsyncStorage.setItem(PEER_VERIFIED_KEY, JSON.stringify(verified));
};

export const isPeerVerified = async () => {
  const raw = await AsyncStorage.getItem(PEER_VERIFIED_KEY);
  return raw ? JSON.parse(raw) : false;
};

export const saveRoomId = async (roomId) => {
  await AsyncStorage.setItem(ROOM_ID_KEY, roomId);
};

export const getSavedRoomId = async () => {
  return AsyncStorage.getItem(ROOM_ID_KEY);
};

export const getFingerprint = (publicKey) => {
  const hash = nacl.hash(publicKey);
  return encodeBase64(hash).slice(0, 32);
};

export const clearAll = async () => {
  await AsyncStorage.multiRemove([KEYPAIR_KEY, PEER_PUB_KEY, PEER_VERIFIED_KEY, ROOM_ID_KEY]);
};
