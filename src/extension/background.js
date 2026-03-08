const api = typeof browser !== "undefined" ? browser : chrome;

const WS_URL = "ws://localhost:7865";
const RECONNECT_INTERVAL = 5000;

let ws = null;

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[bridge] Connected to MCP server");
  };

  ws.onmessage = async (event) => {
    let request;
    try {
      request = JSON.parse(event.data);
    } catch {
      console.error("[bridge] Invalid JSON:", event.data);
      return;
    }

    try {
      const result = await handleRequest(request);
      ws.send(JSON.stringify({ id: request.id, success: true, data: result }));
    } catch (err) {
      ws.send(
        JSON.stringify({ id: request.id, success: false, error: err.message }),
      );
    }
  };

  ws.onclose = () => {
    console.log("[bridge] Disconnected");
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  setTimeout(connect, RECONNECT_INTERVAL);
}

async function getTargetTabId(params) {
  if (params.tabId != null) return params.tabId;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  return tab.id;
}

async function sendToContentScript(tabId, message) {
  let response;
  try {
    response = await api.tabs.sendMessage(tabId, message);
  } catch {
    await api.tabs.executeScript(tabId, { file: "content.js" });
    response = await api.tabs.sendMessage(tabId, message);
  }
  if (response && response.__error) {
    throw new Error(response.__error);
  }
  return response;
}

async function handleRequest(request) {
  const { action, params } = request;

  switch (action) {
    case "tabs.list": {
      const tabs = await api.tabs.query({});
      return tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.active,
        windowId: t.windowId,
      }));
    }

    case "tabs.open": {
      const tab = await api.tabs.create({ url: params.url });
      return { id: tab.id, url: tab.url, title: tab.title };
    }

    case "tabs.close": {
      await api.tabs.remove(params.tabId);
      return null;
    }

    case "tabs.navigate": {
      const tabId = await getTargetTabId(params);
      const tab = await api.tabs.update(tabId, { url: params.url });
      return { id: tab.id, url: tab.url, title: tab.title };
    }

    case "tabs.activate": {
      const tab = await api.tabs.update(params.tabId, { active: true });
      await api.windows.update(tab.windowId, { focused: true });
      return null;
    }

    case "capture.screenshot": {
      const tabId = await getTargetTabId(params);
      const tab = await api.tabs.get(tabId);
      await api.tabs.update(tabId, { active: true });
      await api.windows.update(tab.windowId, { focused: true });
      await new Promise((r) => setTimeout(r, 100));
      const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });
      return dataUrl;
    }

    case "capture.computedStyles": {
      const tabId = await getTargetTabId(params);
      return sendToContentScript(tabId, { action, params });
    }

    case "execution.executeJs": {
      const tabId = await getTargetTabId(params);
      const escaped = JSON.stringify(params.code);
      const results = await api.tabs.executeScript(tabId, {
        code: `(function() { try { var __r = eval(${escaped}); return { success: true, data: __r }; } catch(e) { return { success: false, error: e.message }; } })()`,
      });
      const result = results?.[0];
      if (!result) throw new Error("Script execution returned no result");
      if (!result.success) throw new Error(result.error);
      return result.data;
    }

    default: {
      if (action.startsWith("dom.") || action.startsWith("interaction.")) {
        const tabId = await getTargetTabId(params);
        return sendToContentScript(tabId, { action, params });
      }
      throw new Error(`Unknown action: ${action}`);
    }
  }
}

connect();
