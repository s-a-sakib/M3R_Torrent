const express = require('express');
const { keccak256, verifySignature } = require('./api/validators');
const db = require('./db');

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

app.use(express.static(__dirname));

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function getRegisteredValidator(network, address) {
  try {
    const row = db.prepare('SELECT record_json FROM node_registry WHERE network = ? AND wallet_address = ?').get(network, address);
    return row ? JSON.parse(row.record_json) : null;
  } catch (e) {
    return null;
  }
}

app.post('/:network/dashboard', async (req, res) => {
  const network = req.params.network;
  const payload = req.body || {};
  const signatureHex = String(req.headers['x-signature'] || '');
  const pubKeyCompressedHex = String(req.headers['x-pubkey'] || '');
  const address = String(req.headers['x-address'] || '').toLowerCase();

  if (!signatureHex || !pubKeyCompressedHex || !address) {
    return res.status(401).json({ error: 'missing auth headers' });
  }

  const validator = getRegisteredValidator(network, address);
  if (!validator) {
    return res.status(401).json({ error: 'validator not registered' });
  }
  if (String(validator.pubKeyCompressedHex || '').toLowerCase() !== pubKeyCompressedHex.toLowerCase()) {
    return res.status(401).json({ error: 'validator key mismatch' });
  }

  const msg = canonicalJson(payload);
  const verified = await verifySignature({ message: msg, signatureHex, pubKeyCompressedHex });
  if (!verified) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  const now = Date.now();
  const stmt = db.prepare('INSERT INTO dashboard_snapshots(network, data_json, updated_at) VALUES(?, ?, ?) ON CONFLICT(network) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at');
  stmt.run(network, JSON.stringify(payload), now);
  return res.json({ ok: true });
});

app.post('/:network/validators/announce', async (req, res) => {
  const network = req.params.network;
  const body = req.body;
  const required = ['walletAddress', 'pubKeyCompressedHex', 'signatureHex', 'announcedAt'];
  for (const k of required) {
    if (!body[k]) return res.status(400).json({ status: 'ERROR', message: 'missing ' + k });
  }

  const payload = [
    'TORRENT_ANNOUNCE',
    network,
    body.walletAddress,
    String(body.stake || 0),
    String(body.validationFeeBps || 0),
    String(body.broadcastFeeFlat || 0),
    body.nodeUrl || '',
    body.txRequestUrl || '',
    body.gossipUrl || '',
    String(body.announcedAt),
  ].join('|');

  const ok = await verifySignature({ message: payload, signatureHex: body.signatureHex, pubKeyCompressedHex: body.pubKeyCompressedHex });
  if (!ok) return res.status(400).json({ status: 'ERROR', message: 'invalid signature' });

  const stmt = db.prepare('INSERT INTO node_registry(network, wallet_address, record_json, last_seen) VALUES(?, ?, ?, ?) ON CONFLICT(network, wallet_address) DO UPDATE SET record_json = excluded.record_json, last_seen = excluded.last_seen');
  stmt.run(network, String(body.walletAddress).toLowerCase(), JSON.stringify(body), Date.now());
  return res.json({ status: 'OK' });
});

// Dashboard GET: return snapshot, nodes, counts
app.get('/:network/dashboard', (req, res) => {
  const network = req.params.network;
  try {
    const snapRow = db.prepare('SELECT data_json, updated_at FROM dashboard_snapshots WHERE network = ?').get(network);
    const snapshot = snapRow ? JSON.parse(snapRow.data_json) : {};

    const nodes = db.prepare('SELECT record_json FROM node_registry WHERE network = ? ORDER BY last_seen DESC').all(network)
      .map(r => JSON.parse(r.record_json));

    const nodeStatusCounts = nodes.reduce((acc, n) => {
      const s = (n.status || 'OFFLINE').toUpperCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    res.json({
      status: 'OK',
      generatedAt: Date.now(),
      network,
      snapshot,
      nodes,
      nodeStatusCounts
    });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

app.listen(port, host, () => {
  console.log(`M3R Torrent running at http://${host}:${port}`);
});
