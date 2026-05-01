const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const nodeEnv = process.env.NODE_ENV || "development";
const isDev = nodeEnv !== "production";

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// API routes
app.use('/api/dashboard', require('./api/dashboard'));
app.use('/api/account', require('./api/account'));
app.use('/api/block', require('./api/block'));
app.use('/api/escrow', require('./api/escrow'));
app.use('/api/transaction', require('./api/transaction'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get('/healthz', (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Catch all handler: send back index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, host, () => {
  if (isDev) {
    console.log(`M3R Torrent running at http://${host}:${port}`);
  }
});
