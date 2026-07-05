import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

export const encrypt = (text, peerPublicKey, mySecretKey) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
  // tweetnacl-util naming is inverted: decodeUTF8 = string -> Uint8Array
  const message = decodeUTF8(text);
  const ciphertext = nacl.box(message, nonce, peerPublicKey, mySecretKey);
  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
};

export const decrypt = (payload, peerPublicKey, mySecretKey) => {
  const nonce = decodeBase64(payload.nonce);
  const ciphertext = decodeBase64(payload.ciphertext);
  const decrypted = nacl.box.open(ciphertext, nonce, peerPublicKey, mySecretKey);
  if (!decrypted) {
    throw new Error('Decryption failed — possible MITM or wrong keys');
  }
  // encodeUTF8 = Uint8Array -> string
  return encodeUTF8(decrypted);
};
