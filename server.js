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

function createProxyHandler(handler, mapParams = {}) {
  return (req, res, next) => {
    Object.entries(mapParams).forEach(([key, value]) => {
      if (req.params[value] !== undefined) {
        req.query[key] = req.params[value];
      }
    });
    handler(req, res, next);
  };
}

const apiRouter = express.Router();
apiRouter.get('/:network/dashboard', createProxyHandler(require('./api/dashboard'), { network: 'network' }));
apiRouter.get('/dashboard', require('./api/dashboard'));
apiRouter.get('/:network/account/:address', createProxyHandler(require('./api/account'), { network: 'network', address: 'address' }));
apiRouter.get('/account', require('./api/account'));
apiRouter.get('/:network/transaction/:hash', createProxyHandler(require('./api/transaction'), { network: 'network', hash: 'hash' }));
apiRouter.get('/transaction', require('./api/transaction'));
apiRouter.get('/:network/escrow/:id', createProxyHandler(require('./api/escrow'), { network: 'network', id: 'id' }));
apiRouter.get('/escrow', require('./api/escrow'));
apiRouter.get('/:network/block/:ref', createProxyHandler(require('./api/block'), { network: 'network', heightOrHash: 'ref' }));
apiRouter.get('/block', require('./api/block'));

apiRouter.post('/dashboard', require('./api/dashboard'));
apiRouter.post('/account', require('./api/account'));
apiRouter.post('/transaction', require('./api/transaction'));
apiRouter.post('/escrow', require('./api/escrow'));
apiRouter.post('/block', require('./api/block'));

app.use(['/api', '/torrent/api'], apiRouter);

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
