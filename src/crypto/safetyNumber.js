import nacl from 'tweetnacl';

export const getSafetyNumber = (myPublicKey, peerPublicKey) => {
  const combined = new Uint8Array([...myPublicKey, ...peerPublicKey]);
  const hash = nacl.hash(combined); // SHA-512
  return Array.from(hash.slice(0, 15))
    .map(b => b.toString().padStart(3, '0'))
    .join(' ')
    .match(/.{1,15}/g)
    .join('\n');
};
