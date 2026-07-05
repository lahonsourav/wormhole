import { useState, useEffect } from 'react';
import { initKeys, getPeerPublicKey, isPeerVerified, getFingerprint } from '../crypto/keyManager';
import { encodeBase64 } from 'tweetnacl-util';

export const useEncryption = () => {
  const [myKeys, setMyKeys] = useState(null);
  const [peerPublicKey, setPeerPublicKey] = useState(null);
  const [peerVerified, setPeerVerified] = useState(false);
  const [myFingerprint, setMyFingerprint] = useState('');

  useEffect(() => {
    const load = async () => {
      const keys = await initKeys();
      setMyKeys(keys);
      setMyFingerprint(getFingerprint(keys.publicKey));

      const peer = await getPeerPublicKey();
      if (peer) setPeerPublicKey(peer);

      const verified = await isPeerVerified();
      setPeerVerified(verified);
    };
    load().catch(console.error);
  }, []);

  const myPublicKeyBase64 = myKeys ? encodeBase64(myKeys.publicKey) : '';

  return { myKeys, peerPublicKey, setPeerPublicKey, peerVerified, setPeerVerified, myPublicKeyBase64, myFingerprint };
};
