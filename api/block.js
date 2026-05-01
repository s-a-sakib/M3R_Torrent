const data = require('./_data');

module.exports = (req, res) => {
  const { network = 'mainnet', heightOrHash } = req.query;

  if (!heightOrHash) {
    return res.status(400).json({ error: 'Height or hash required' });
  }

  if (req.method === 'GET') {
    const block = data.blocks[`${network}:${heightOrHash}`];
    if (block) {
      res.status(200).json({ status: 'OK', block });
    } else {
      res.status(404).json({ status: 'ERROR', message: 'Block not found' });
    }
  } else if (req.method === 'POST') {
    // Nodes can POST block data
    const body = req.body;
    if (body && (body.height || body.hash)) {
      const key = body.height ? `${network}:${body.height}` : `${network}:${body.hash}`;
      data.blocks[key] = body;
      // Also add to network's recent blocks
      const netData = data.networks[network];
      if (netData && netData.blocks) {
        netData.blocks.unshift(body);
        netData.blocks = netData.blocks.slice(0, 10); // Keep recent 10
      }
      res.status(200).json({ status: 'updated' });
    } else {
      res.status(400).json({ error: 'Invalid block data' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};