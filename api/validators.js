const data = require('./_data');
const crypto = require('crypto');

const LIVE_WINDOW_MS = 90_000;
const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;
const THREE = 3n;
const P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const GX = BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
const GY = BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8');
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const MASK_64 = (1n << 64n) - 1n;

function normalizeNetwork(value) {
  const network = String(value || 'mainnet').trim().toLowerCase();
  return ['mainnet', 'testnet', 'legacy'].includes(network) ? network : 'mainnet';
}

function registryFor(network) {
  const normalized = normalizeNetwork(network);
  if (!data.nodeRegistry[normalized]) {
    data.nodeRegistry[normalized] = {};
  }
  return data.nodeRegistry[normalized];
}

function handleAnnounce(req, res) {
  const network = normalizeNetwork(req.query.network || req.params?.network);
  const body = req.body || {};
  const missing = ['walletAddress', 'pubKeyCompressedHex', 'signatureHex', 'announcedAt']
    .filter((key) => body[key] === undefined || body[key] === null || String(body[key]).trim() === '');
  if (missing.length) {
    return res.status(400).json({ status: 'ERROR', message: `missing announcement fields: ${missing.join(', ')}` });
  }

  try {
    const pubKey = hexToBytes(body.pubKeyCompressedHex);
    const walletAddress = String(body.walletAddress).toLowerCase();
    const derivedAddress = deriveAddress20Hex(pubKey);
    if (derivedAddress !== walletAddress) {
      return res.status(400).json({ status: 'ERROR', message: 'wallet address does not match public key' });
    }

    const payload = announcementPayload(network, body);
    const payloadBytes = Buffer.from(payload, 'utf8');
    const signatureBytes = hexToBytes(body.signatureHex);
    const ok = verifySha256Signature(payloadBytes, signatureBytes, pubKey)
      || verifySignature(keccak256(payloadBytes), signatureBytes, pubKey);
    if (!ok) {
      return res.status(400).json({ status: 'ERROR', message: 'invalid signature' });
    }

    const now = Date.now();
    const record = {
      walletAddress,
      pubKeyCompressedHex: String(body.pubKeyCompressedHex).toLowerCase(),
      stake: Number(body.stake || 0),
      validationFeeBps: Number(body.validationFeeBps || 0),
      broadcastFeeFlat: Number(body.broadcastFeeFlat || 0),
      nodeUrl: clean(body.nodeUrl),
      txRequestUrl: clean(body.txRequestUrl),
      gossipUrl: clean(body.gossipUrl),
      status: clean(body.status || 'LIVE').toUpperCase(),
      signatureHex: String(body.signatureHex).toLowerCase(),
      announcedAt: Number(body.announcedAt),
      lastSeen: now,
    };
    registryFor(network)[walletAddress] = record;
    syncNetworkNodes(network);
    return res.status(200).json({ status: 'OK' });
  } catch (error) {
    return res.status(400).json({ status: 'ERROR', message: 'invalid announcement payload' });
  }
}

function handleOffline(req, res) {
  const body = { ...(req.body || {}), status: 'OFFLINE' };
  req.body = body;
  return handleAnnounce(req, res);
}

function handleNodes(req, res) {
  const network = normalizeNetwork(req.query.network || req.params?.network);
  const nodes = listNodes(network);
  return res.status(200).json({ status: 'OK', network, nodes, nodeStatusCounts: statusCounts(nodes) });
}

function handleLiveNode(req, res) {
  const network = normalizeNetwork(req.query.network || req.params?.network);
  const live = listNodes(network)
    .filter((node) => node.status === 'LIVE' && node.txRequestUrl && node.nodeUrl)
    .sort((a, b) => b.lastSeen - a.lastSeen)[0];
  if (!live) {
    return res.status(200).json({ status: 'NO_LIVE_NODE', message: 'No live node available' });
  }
  return res.status(200).json({
    status: 'OK',
    node: {
      txRequestUrl: live.txRequestUrl,
      nodeUrl: live.nodeUrl,
      gossipUrl: live.gossipUrl,
      walletAddress: live.walletAddress,
      fees: {
        validationFeeBps: live.validationFeeBps,
        broadcastFeeFlat: live.broadcastFeeFlat,
      },
    },
  });
}

function listNodes(network) {
  const now = Date.now();
  return Object.values(registryFor(network))
    .map((record) => {
      const ageMs = Math.max(0, now - Number(record.lastSeen || 0));
      const status = record.status === 'LIVE' && ageMs > LIVE_WINDOW_MS ? 'OFFLINE' : record.status;
      return { ...record, status, ageMs };
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

function statusCounts(nodes) {
  return nodes.reduce((counts, node) => {
    counts[node.status] = (counts[node.status] || 0) + 1;
    return counts;
  }, { LIVE: 0, OFFLINE: 0, JAILED: 0, PENDING: 0 });
}

function syncNetworkNodes(network) {
  const nodes = listNodes(network);
  if (!data.networks[network]) {
    return;
  }
  data.networks[network].nodes = nodes;
  data.networks[network].nodeStatusCounts = statusCounts(nodes);
  data.networks[network].generatedAt = Date.now();
}

function applyRegistryToDashboard(network, dashboard) {
  const nodes = listNodes(network);
  const reportedNodes = Array.isArray(dashboard.nodes) ? dashboard.nodes : [];
  dashboard.reportedNodes = reportedNodes.map((node) => ({
    ...node,
    registrySource: 'SNAPSHOT',
    registryVerified: false,
  }));
  dashboard.nodes = nodes.length > 0 ? nodes.map((node) => ({
    ...node,
    registrySource: 'SIGNED',
    registryVerified: true,
  })) : dashboard.reportedNodes;
  dashboard.nodeStatusCounts = statusCounts(nodes);
  dashboard.registryStatus = nodes.length > 0 ? 'SIGNED' : (reportedNodes.length > 0 ? 'SNAPSHOT_ONLY' : 'EMPTY');
  return dashboard;
}

function announcementPayload(network, body) {
  return [
    'TORRENT_ANNOUNCE',
    network,
    clean(body.walletAddress).toLowerCase(),
    String(body.stake),
    String(body.validationFeeBps),
    String(body.broadcastFeeFlat),
    clean(body.nodeUrl),
    clean(body.txRequestUrl),
    clean(body.gossipUrl),
    String(body.announcedAt),
  ].join('|');
}

function deriveAddress20Hex(pubKey) {
  return bytesToHex(keccak256(pubKey).slice(12));
}

function verifySignature(hash, signature, pubKey) {
  try {
    const spki = Buffer.concat([
      Buffer.from('3036301006072a8648ce3d020106052b8104000a032200', 'hex'),
      Buffer.from(pubKey),
    ]);
    const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return crypto.verify(null, hash, key, signature);
  } catch (error) {
    return false;
  }
}

function verifySha256Signature(payload, signature, pubKey) {
  try {
    const spki = Buffer.concat([
      Buffer.from('3036301006072a8648ce3d020106052b8104000a032200', 'hex'),
      Buffer.from(pubKey),
    ]);
    const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return crypto.verify('sha256', payload, key, signature);
  } catch (error) {
    return false;
  }
}

function verifySignatureManual(hash, signature, pubKey) {
  const sig = parseDerSignature(signature);
  if (!sig || sig.r <= ZERO || sig.r >= N || sig.s <= ZERO || sig.s >= N) {
    return false;
  }
  const q = decompressPublicKey(pubKey);
  if (!q) {
    return false;
  }
  const z = bytesToBigInt(hash) % N;
  const w = modInv(sig.s, N);
  const u1 = mod(z * w, N);
  const u2 = mod(sig.r * w, N);
  const point = pointAdd(pointMultiply(G, u1), pointMultiply(q, u2));
  return point !== null && mod(point.x, N) === sig.r;
}

function parseDerSignature(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x30) {
    return null;
  }
  let offset = 2;
  if (bytes[1] & 0x80) {
    const lenBytes = bytes[1] & 0x7f;
    offset = 2 + lenBytes;
  }
  if (bytes[offset] !== 0x02) {
    return null;
  }
  const rLen = bytes[offset + 1];
  const r = bytesToBigInt(bytes.slice(offset + 2, offset + 2 + rLen));
  offset += 2 + rLen;
  if (bytes[offset] !== 0x02) {
    return null;
  }
  const sLen = bytes[offset + 1];
  const s = bytesToBigInt(bytes.slice(offset + 2, offset + 2 + sLen));
  return { r, s };
}

function decompressPublicKey(bytes) {
  if (bytes.length !== 33 || (bytes[0] !== 0x02 && bytes[0] !== 0x03)) {
    return null;
  }
  const x = bytesToBigInt(bytes.slice(1));
  const ySquared = mod(x ** THREE + 7n, P);
  let y = modPow(ySquared, (P + ONE) / 4n, P);
  if ((y & ONE) !== BigInt(bytes[0] & 1)) {
    y = P - y;
  }
  return { x, y };
}

const G = { x: GX, y: GY };

function pointAdd(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  if (a.x === b.x && mod(a.y + b.y, P) === ZERO) return null;
  const m = a.x === b.x && a.y === b.y
    ? mod((THREE * a.x * a.x) * modInv(TWO * a.y, P), P)
    : mod((b.y - a.y) * modInv(b.x - a.x, P), P);
  const x = mod(m * m - a.x - b.x, P);
  const y = mod(m * (a.x - x) - a.y, P);
  return { x, y };
}

function pointMultiply(point, scalar) {
  let n = scalar;
  let result = null;
  let addend = point;
  while (n > ZERO) {
    if (n & ONE) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    n >>= ONE;
  }
  return result;
}

function modInv(value, modulo) {
  let a = mod(value, modulo);
  let b = modulo;
  let x = ZERO;
  let y = ONE;
  let u = ONE;
  let v = ZERO;
  while (a !== ZERO) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a; a = r; x = u; y = v; u = m; v = n;
  }
  return mod(x, modulo);
}

function modPow(base, exponent, modulo) {
  let result = ONE;
  let b = mod(base, modulo);
  let e = exponent;
  while (e > ZERO) {
    if (e & ONE) result = mod(result * b, modulo);
    b = mod(b * b, modulo);
    e >>= ONE;
  }
  return result;
}

function keccak256(input) {
  const rate = 136;
  const state = Array(25).fill(0n);
  const bytes = Buffer.from(input);
  const paddedLength = Math.ceil((bytes.length + 1) / rate) * rate;
  const padded = Buffer.alloc(paddedLength);
  bytes.copy(padded);
  padded[bytes.length] = 0x01;
  padded[paddedLength - 1] ^= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      state[i] ^= readLane(padded, offset + i * 8);
    }
    keccakF(state);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    writeLane(out, i * 8, state[i]);
  }
  return out;
}

function keccakF(a) {
  for (const rc of RC) {
    const c = Array(5);
    for (let x = 0; x < 5; x++) {
      c[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] ^= d;
      }
    }

    const b = Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y], ROT[x][y]);
      }
    }

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] = b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y]);
        a[x + 5 * y] &= MASK_64;
      }
    }
    a[0] ^= rc;
  }
}

function rotl(value, shift) {
  const s = BigInt(shift);
  if (s === ZERO) return value & MASK_64;
  return ((value << s) | (value >> (64n - s))) & MASK_64;
}

function readLane(bytes, offset) {
  let lane = 0n;
  for (let i = 0; i < 8; i++) {
    lane |= BigInt(bytes[offset + i]) << BigInt(8 * i);
  }
  return lane;
}

function writeLane(out, offset, lane) {
  for (let i = 0; i < 8; i++) {
    out[offset + i] = Number((lane >> BigInt(8 * i)) & 0xffn);
  }
}

function hexToBytes(value) {
  const hex = String(value || '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('invalid hex');
  }
  return Buffer.from(hex, 'hex');
}

function bytesToHex(value) {
  return Buffer.from(value).toString('hex');
}

function bytesToBigInt(value) {
  const hex = bytesToHex(value);
  return hex ? BigInt(`0x${hex}`) : ZERO;
}

function mod(value, modulo) {
  const result = value % modulo;
  return result >= ZERO ? result : result + modulo;
}

function clean(value) {
  return value == null ? '' : String(value).trim();
}

module.exports = {
  handleAnnounce,
  handleOffline,
  handleNodes,
  handleLiveNode,
  listNodes,
  statusCounts,
  applyRegistryToDashboard,
  keccak256,
  verifySignature,
};
