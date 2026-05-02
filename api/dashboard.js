const data = require('./_data');
const validators = require('./validators');

module.exports = (req, res) => {
  const { network = 'mainnet' } = req.query;
  const networkData = data.networks[network] || data.networks.mainnet;

  if (req.method === 'GET') {
    res.status(200).json(validators.applyRegistryToDashboard(network, { ...networkData }));
  } else if (req.method === 'POST') {
    // Nodes can POST updated dashboard data
    const body = req.body;
    if (body && typeof body === 'object') {
      Object.assign(networkData, body);
      validators.applyRegistryToDashboard(network, networkData);
      networkData.generatedAt = Date.now();
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
