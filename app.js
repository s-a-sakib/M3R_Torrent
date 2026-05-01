const defaultApiBase = "https://m3r-torrent.onrender.com/torrent/api";
const state = {
  apiBase: localStorage.getItem("m3r-torrent-api-base") || defaultApiBase,
  network: localStorage.getItem("m3r-torrent-network") || "mainnet",
};
let apiBaseInput;
let networkSelect;
let refreshBtn;
let currentData = null;
let txPage = 1;
let escrowPage = 1;
const pageSize = 10;

function init() {
  apiBaseInput = document.getElementById("apiBase");
  networkSelect = document.getElementById("network");
  refreshBtn = document.getElementById("refreshBtn");

  apiBaseInput.value = state.apiBase;
  networkSelect.value = state.network;

  document.getElementById("refreshBtn").addEventListener("click", () => {
    persistConfig();
    loadDashboard();
  });

  document.getElementById("accountSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    lookup("account", event.target.value.value.trim(), renderAccountResult);
  });

  document.getElementById("txSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    lookup("transaction", event.target.value.value.trim(), renderTxResult);
  });

  document.getElementById("blockSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    lookup("block", event.target.value.value.trim(), renderBlockResult);
  });

  document.getElementById("escrowSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    lookup("escrow", event.target.value.value.trim(), renderEscrowResult);
  });

  networkSelect.addEventListener("change", () => {
    persistConfig();
    loadDashboard();
  });

  loadDashboard();
}

document.addEventListener("DOMContentLoaded", init);

function setLoadingState(isLoading) {
  if (refreshBtn) {
    refreshBtn.disabled = isLoading;
    refreshBtn.textContent = isLoading ? "Loading..." : "Refresh";
  }
}

function persistConfig() {
  state.apiBase = apiBaseInput.value.replace(/\/+$/, "");
  state.network = networkSelect.value;
  localStorage.setItem("m3r-torrent-api-base", state.apiBase);
  localStorage.setItem("m3r-torrent-network", state.network);
}

async function loadDashboard() {
  setLoadingState(true);
  setText("lastUpdated", "Loading...");
  txPage = 1;
  escrowPage = 1;
  try {
    const data = await fetchJson(`${state.apiBase}/${state.network}/dashboard`);
    currentData = data;
    renderStats(data);
    renderPerformance(data.performance, data.tip, data.generatedAt);
    renderNodes(data.nodes || []);
    renderBlocks(data.blocks || []);
    renderTransactions(data.transactions || []);
    renderEscrows(data.escrows || []);
  } catch (error) {
    setText("lastUpdated", `Failed to load: ${error.message}`);
    renderErrorTables(error.message);
  } finally {
    setLoadingState(false);
  }
}

async function lookup(kind, value, renderer) {
  if (!value) {
    return;
  }
  persistConfig();
  renderer({ status: "LOADING" });
  try {
    const data = await fetchJson(`${state.apiBase}/${state.network}/${kind}/${encodeURIComponent(value)}`);
    renderer(data);
  } catch (error) {
    renderer({ status: "ERROR", message: error.message });
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    const body = text ? ` - ${text}` : "";
    throw new Error(`Request failed ${response.status}${body}`);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Invalid JSON response from ${url}`);
  }
}

function renderStats(data) {
  const stats = [
    ["Tip Height", data.tip?.height ?? 0],
    ["Live Nodes", data.nodeStatusCounts?.LIVE ?? 0],
    ["Active Validators", data.validatorStatusCounts?.ACTIVE ?? 0],
    ["Recent Tx", (data.transactions || []).length],
    ["Escrows", (data.escrows || []).length],
    ["Peers", (data.peers || []).length],
  ];
  document.getElementById("stats").innerHTML = stats.map(([label, value]) => `
    <div class="stat-card">
      <div class="stat-key">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(String(value))}</div>
    </div>
  `).join("");
}

function renderPerformance(performance, tip, generatedAt) {
  const items = [
    ["Chain Height", performance?.chainHeight ?? tip?.height ?? 0],
    ["Avg Block Interval", formatMs(performance?.averageBlockIntervalMs ?? 0)],
    ["Validator Count", performance?.validatorCount ?? 0],
    ["Live Node Count", performance?.liveNodeCount ?? 0],
    ["Recent Blocks", performance?.recentBlockCount ?? 0],
  ];
  document.getElementById("performanceGrid").innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `).join("");
  setText("lastUpdated", `Updated ${new Date(generatedAt || Date.now()).toLocaleString()}`);
}

function renderNodes(nodes) {
  document.getElementById("nodesTable").innerHTML = toTable(
    ["Wallet", "Status", "Stake", "Validation Fee", "Broadcast Fee", "Node URL"],
    nodes.map((node) => [
      mono(node.walletAddress),
      badge(node.status || "OFFLINE"),
      node.stake ?? 0,
      `${node.validationFeeBps ?? 0} bps`,
      node.broadcastFeeFlat ?? 0,
      mono(node.nodeUrl || ""),
    ]),
    "No nodes announced."
  );
}

function renderBlocks(blocks) {
  document.getElementById("blocksTable").innerHTML = toTable(
    ["Height", "Hash", "Proposer", "Tx", "Actions", "Timestamp"],
    blocks.map((block) => [
      block.height,
      mono(block.hash),
      mono(block.proposer),
      block.transactions?.length ?? 0,
      block.actions?.length ?? 0,
      new Date(block.timestampMillis).toLocaleString(),
    ]),
    "No blocks found."
  );
}

function renderTransactions(transactions) {
  const start = (txPage - 1) * pageSize;
  const end = start + pageSize;
  const paginated = transactions.slice(start, end);
  document.getElementById("transactionsTable").innerHTML = toTable(
    ["Hash", "Status", "Created"],
    paginated.map((tx) => [
      mono(tx.hash),
      badge(tx.status || "UNKNOWN"),
      new Date(tx.createdAt).toLocaleString(),
    ]),
    "No transactions found."
  );
  updatePagination("txPagination", txPage, Math.ceil(transactions.length / pageSize));
}

function renderEscrows(escrows) {
  const start = (escrowPage - 1) * pageSize;
  const end = start + pageSize;
  const paginated = escrows.slice(start, end);
  document.getElementById("escrowsTable").innerHTML = toTable(
    ["Escrow", "Buyer", "Seller", "Status", "Amount"],
    paginated.map((escrow) => [
      mono(escrow.escrowId),
      mono(escrow.buyer),
      mono(escrow.seller),
      badge(escrow.status || "OPEN"),
      escrow.amount,
    ]),
    "No escrows found."
  );
  updatePagination("escrowPagination", escrowPage, Math.ceil(escrows.length / pageSize));
}

function renderErrorTables(message) {
  const markup = `<div class="detail-card">${escapeHtml(message)}</div>`;
  document.getElementById("nodesTable").innerHTML = markup;
  document.getElementById("blocksTable").innerHTML = markup;
  document.getElementById("transactionsTable").innerHTML = markup;
  document.getElementById("escrowsTable").innerHTML = markup;
}

function renderAccountResult(data) {
  const target = document.getElementById("accountResult");
  if (data.status === "LOADING") {
    target.innerHTML = "Loading account...";
    return;
  }
  if (data.status !== "OK") {
    target.innerHTML = escapeHtml(data.message || "Account not found.");
    return;
  }
  target.innerHTML = renderDetailList([
    ["Address", mono(data.account.address)],
    ["Balance", data.account.balance],
    ["Nonce", data.account.nonce],
    ["Ledger Entries", (data.ledger || []).length],
  ]);
}

function renderTxResult(data) {
  const target = document.getElementById("txResult");
  if (data.status === "LOADING") {
    target.innerHTML = "Loading transaction...";
    return;
  }
  if (data.status !== "OK") {
    target.innerHTML = escapeHtml(data.message || "Transaction not found.");
    return;
  }
  target.innerHTML = renderDetailList([
    ["Hash", mono(data.transaction.hash)],
    ["Status", badge(data.transaction.status)],
    ["Created", new Date(data.transaction.createdAt).toLocaleString()],
  ]);
}

function renderBlockResult(data) {
  const target = document.getElementById("blockResult");
  if (data.status === "LOADING") {
    target.innerHTML = "Loading block...";
    return;
  }
  if (data.status !== "OK") {
    target.innerHTML = escapeHtml(data.message || "Block not found.");
    return;
  }
  const block = data.block;
  target.innerHTML = renderDetailList([
    ["Height", block.height],
    ["Hash", mono(block.hash)],
    ["Previous", mono(block.previousHash)],
    ["Proposer", mono(block.proposer)],
    ["Transactions", block.transactions?.length ?? 0],
    ["Actions", block.actions?.length ?? 0],
  ]);
}

function renderEscrowResult(data) {
  const target = document.getElementById("escrowResult");
  if (data.status === "LOADING") {
    target.innerHTML = "Loading escrow...";
    return;
  }
  if (data.status !== "OK") {
    target.innerHTML = escapeHtml(data.message || "Escrow not found.");
    return;
  }
  const escrow = data.escrow;
  target.innerHTML = renderDetailList([
    ["Escrow Id", mono(escrow.escrowId)],
    ["Buyer", mono(escrow.buyer)],
    ["Seller", mono(escrow.seller)],
    ["Arbiter", mono(escrow.arbiter)],
    ["Amount", escrow.amount],
    ["Status", badge(escrow.status)],
  ]);
}

function renderDetailList(items) {
  return `<div class="detail-list">${items.map(([label, value]) => `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <div>${value}</div>
    </div>
  `).join("")}</div>`;
}

function toTable(headers, rows, emptyText) {
  if (!rows.length) {
    return `<div class="detail-card empty">${escapeHtml(emptyText)}</div>`;
  }
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function badge(value) {
  const normalized = String(value || "UNKNOWN").toLowerCase();
  const cssClass = ["live", "offline", "jailed", "pending"].includes(normalized) ? normalized : "pending";
  return `<span class="badge ${cssClass}">${escapeHtml(String(value))}</span>`;
}

function mono(value) {
  return `<span class="mono">${escapeHtml(String(value || ""))}</span>`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function formatMs(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "n/a";
  }
  const seconds = Math.round(value / 1000);
  return `${seconds}s`;
}

function updatePagination(paginationId, currentPage, totalPages) {
  const paginationEl = document.getElementById(paginationId);
  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  const prevId = paginationId.replace("Pagination", "Prev");
  const nextId = paginationId.replace("Pagination", "Next");
  paginationEl.innerHTML = `
    <button id="${prevId}" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${currentPage} of ${totalPages}</span>
    <button id="${nextId}" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
  `;

  const prevButton = document.getElementById(prevId);
  const nextButton = document.getElementById(nextId);

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (paginationId === "txPagination" && txPage > 1) {
        txPage--;
        renderTransactions(currentData?.transactions || []);
      }
      if (paginationId === "escrowPagination" && escrowPage > 1) {
        escrowPage--;
        renderEscrows(currentData?.escrows || []);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (paginationId === "txPagination") {
        const total = Math.ceil((currentData?.transactions || []).length / pageSize);
        if (txPage < total) {
          txPage++;
          renderTransactions(currentData?.transactions || []);
        }
      }
      if (paginationId === "escrowPagination") {
        const total = Math.ceil((currentData?.escrows || []).length / pageSize);
        if (escrowPage < total) {
          escrowPage++;
          renderEscrows(currentData?.escrows || []);
        }
      }
    });
  }
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
