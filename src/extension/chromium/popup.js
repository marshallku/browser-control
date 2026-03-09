const pApi = typeof browser !== "undefined" ? browser : chrome;

// ── Connection status ──────────────────────────────────────────────────

const $status = document.getElementById("status");

// Ask background script for WS connection status
pApi.runtime.sendMessage({ type: "getStatus" }, (res) => {
  if (res && res.connected) {
    $status.innerHTML = '<span class="dot on"></span>Connected to MCP server';
  } else {
    $status.innerHTML = '<span class="dot off"></span>Not connected';
  }
});

// ── Buttons ────────────────────────────────────────────────────────────

document.getElementById("btn-creds").addEventListener("click", () => {
  pApi.tabs.create({ url: pApi.runtime.getURL("credentials.html") });
  window.close();
});

document.getElementById("btn-options").addEventListener("click", () => {
  pApi.runtime.openOptionsPage();
  window.close();
});
