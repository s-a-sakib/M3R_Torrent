# M3R Torrent

Public dashboard for the M3R network.

## Run Locally

1. Install dependencies if needed:

```bash
cd Torrent
npm install
```

2. Run the dashboard server:

```bash
npm start
```

3. Open `http://localhost:4173`.

## Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`

2. Deploy:

```bash
vercel
```

The app will be deployed as a static site with serverless API functions.

## API Documentation

This dashboard provides API endpoints for nodes to submit blockchain data and for clients to query it.

### Endpoints

- `GET /api/dashboard?network={network}`
  - Returns dashboard metrics, recent nodes, blocks, transactions, and escrow summaries.

- `POST /api/dashboard?network={network}`
  - Nodes submit updated dashboard data (e.g., tip height, node counts, performance metrics).

- `GET /api/account/{address}?network={network}`
  - Returns account details, balance, nonce, and ledger entries.

- `POST /api/account/{address}?network={network}`
  - Nodes submit account data.

- `GET /api/transaction/{hash}?network={network}`
  - Returns a transaction record, status, and timestamps.

- `POST /api/transaction/{hash}?network={network}`
  - Nodes submit transaction data.

- `GET /api/block/{heightOrHash}?network={network}`
  - Returns block details for a block height or hash.

- `POST /api/block/{heightOrHash}?network={network}`
  - Nodes submit block data.

- `GET /api/escrow/{id}?network={network}`
  - Returns escrow details, parties, amount, and status.

- `POST /api/escrow/{id}?network={network}`
  - Nodes submit escrow data.

- `GET /health`
  - Returns a lightweight service health response.

### Data Storage

Data is stored in-memory and is ephemeral (resets on serverless cold starts). For production, integrate a persistent database.

### Example Node Submission

Nodes can POST data like:

```bash
curl -X POST https://your-vercel-app.vercel.app/api/dashboard?network=mainnet \
  -H "Content-Type: application/json" \
  -d '{"tip": {"height": 12345}, "nodeStatusCounts": {"LIVE": 10}}'
```

## Notes

- The UI supports switching between `mainnet`, `testnet`, and `legacy` networks.
- The dashboard automatically refreshes data when the network changes.
- Use the top-bar backend field to point the app at a different API host if needed (defaults to `/api`).
