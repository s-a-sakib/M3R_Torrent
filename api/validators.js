const crypto = require('crypto');
const { Signature, hexToBytes, verify } = require('@noble/secp256k1');

// Keep same function signatures as before: keccak256(data) and verifySignature(opts)

function keccak256(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  const algo = crypto.getHashes().includes('keccak256') ? 'keccak256' : 'sha3-256';
  const h = crypto.createHash(algo);
  h.update(buf);
  return h.digest('hex');
}

/**
 * verifySignature({ message, signatureHex, pubKeyCompressedHex }) -> boolean
 * - message: Buffer|string (raw message bytes). We'll hash with keccak256 first.
 * - signatureHex: hex string (64 or 65 bytes; compact or DER) produced by signer
 * - pubKeyCompressedHex: hex string of compressed public key (33 bytes)
 */
async function verifySignature({ message, signatureHex, pubKeyCompressedHex }) {
  if (!message || !signatureHex || !pubKeyCompressedHex) return false;
  const msgBuf = Buffer.isBuffer(message) ? message : Buffer.from(String(message));
  const msgHash = hexToBytes(keccak256(msgBuf));

  let compactSig;
  try {
    const sigBytes = hexToBytes(signatureHex);
    compactSig = sigBytes.length === 64 ? sigBytes : Signature.fromDER(sigBytes).toCompactRawBytes();
  } catch (e) {
    return false;
  }

  let pubKeyBytes;
  try {
    pubKeyBytes = hexToBytes(pubKeyCompressedHex);
  } catch (e) {
    return false;
  }

  try {
    return await verify(compactSig, msgHash, pubKeyBytes);
  } catch (err) {
    return false;
  }
}

module.exports = {
  keccak256,
  verifySignature,
};
