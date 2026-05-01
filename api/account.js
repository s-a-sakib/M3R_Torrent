const data = require('./_data');

module.exports = (req, res) => {
  const { network = 'mainnet', address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }

  if (req.method === 'GET') {
    const account = data.accounts[`${network}:${address}`];
    if (account) {
      res.status(200).json({ status: 'OK', account, ledger: [] });
    } else {
      res.status(404).json({ status: 'ERROR', message: 'Account not found' });
    }
  } else if (req.method === 'POST') {
    // Nodes can POST account data
    const body = req.body;
    if (body && body.address) {
      data.accounts[`${network}:${address}`] = body;
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid account data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};