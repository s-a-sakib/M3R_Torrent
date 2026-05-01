const data = require('./_data');

module.exports = (req, res) => {
  const { network = 'mainnet', id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Escrow ID required' });
  }

  if (req.method === 'GET') {
    const escrow = data.escrows[`${network}:${id}`];
    if (escrow) {
      res.status(200).json({ status: 'OK', escrow });
    } else {
      res.status(404).json({ status: 'ERROR', message: 'Escrow not found' });
    }
  } else if (req.method === 'POST') {
    // Nodes can POST escrow data
    const body = req.body;
    if (body && body.escrowId) {
      data.escrows[`${network}:${id}`] = body;
      // Also add to network's recent escrows
      const netData = data.networks[network];
      if (netData && netData.escrows) {
        netData.escrows.unshift(body);
        netData.escrows = netData.escrows.slice(0, 10); // Keep recent 10
      }
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid escrow data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};