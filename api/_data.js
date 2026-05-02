// Shared in-memory data store (ephemeral - resets on cold start)
function createNetworkData() {
  return {
    tip: { height: 0 },
    nodeStatusCounts: { LIVE: 0 },
    validatorStatusCounts: { ACTIVE: 0 },
    performance: { averageBlockIntervalMs: 0, validatorCount: 0, liveNodeCount: 0, recentBlockCount: 0 },
    nodes: [],
    blocks: [],
    transactions: [],
    escrows: [],
    peers: [],
    generatedAt: Date.now(),
  };
}

function createNetworkRegistry() {
  return {};
}

const data = {
  networks: {
    mainnet: createNetworkData(),
    testnet: createNetworkData(),
    legacy: createNetworkData(),
  },
  nodeRegistry: {
    mainnet: createNetworkRegistry(),
    testnet: createNetworkRegistry(),
    legacy: createNetworkRegistry(),
  },
  accounts: {},
  transactions: {},
  blocks: {},
  escrows: {},
};

module.exports = data;
