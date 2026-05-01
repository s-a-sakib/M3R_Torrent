const data = require('./_data');

module.exports = (req, res) => {
  const { network = 'mainnet' } = req.query;

  if (req.method === 'GET') {
    const networkData = data.networks[network] || data.networks.mainnet;
    res.status(200).json(networkData);
  } else if (req.method === 'POST') {
    // Nodes can POST updated dashboard data
    const body = req.body;
    if (body && typeof body === 'object') {
      Object.assign(data.networks[network], body);
      data.networks[network].generatedAt = Date.now();
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};