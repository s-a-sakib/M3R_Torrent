const data = require('./_data');

module.exports = (req, res) => {
  const { network = 'mainnet', hash } = req.query;

  if (!hash) {
    return res.status(400).json({ error: 'Hash required' });
  }

  if (req.method === 'GET') {
    const transaction = data.transactions[`${network}:${hash}`];
    if (transaction) {
      res.status(200).json({ status: 'OK', transaction });
    } else {
      res.status(404).json({ status: 'ERROR', message: 'Transaction not found' });
    }
  } else if (req.method === 'POST') {
    // Nodes can POST transaction data
    const body = req.body;
    if (body && body.hash) {
      data.transactions[`${network}:${hash}`] = body;
      // Also add to network's recent transactions
      const netData = data.networks[network];
      if (netData && netData.transactions) {
        netData.transactions.unshift(body);
        netData.transactions = netData.transactions.slice(0, 10); // Keep recent 10
      }
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid transaction data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};