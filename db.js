const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'torrent.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS node_registry (
  network TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  record_json TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (network, wallet_address)
);

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  network TEXT NOT NULL PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS block_index (
  network TEXT NOT NULL,
  ref TEXT NOT NULL,
  block_json TEXT NOT NULL,
  PRIMARY KEY (network, ref)
);
`);

module.exports = db;
