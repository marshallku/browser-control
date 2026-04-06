const WS_URL = "ws://localhost:7865";
const RECONNECT_INTERVAL = 5000;

let ws = null;

const dialogState = {
    behavior: { action: "dismiss", text: undefined },
    lastDialog: null,
};

function setupDialogOverride(tabId) {
    const code = `
    if (!window.__dialogOverrideInstalled) {
      window.__dialogOverrideInstalled = true;
      const origAlert = window.alert;
      const origConfirm = window.confirm;
      const origPrompt = window.prompt;

      window.alert = function(message) {
        window.__lastDialog = { type: "alert", message: String(message) };
        window.dispatchEvent(new CustomEvent("__dialogCaptured", { detail: window.__lastDialog }));
      };
      window.confirm = function(message) {
        window.__lastDialog = { type: "confirm", message: String(message) };
        window.dispatchEvent(new CustomEvent("__dialogCaptured", { detail: window.__lastDialog }));
        return window.__dialogBehavior?.action === "accept";
      };
      window.prompt = function(message, defaultValue) {
        window.__lastDialog = { type: "prompt", message: String(message), defaultValue };
        window.dispatchEvent(new CustomEvent("__dialogCaptured", { detail: window.__lastDialog }));
        if (window.__dialogBehavior?.action === "accept") {
          return window.__dialogBehavior?.text ?? defaultValue ?? "";
        }
        return null;
      };
    }
  `;
    return chrome.scripting.executeScript({
        target: { tabId },
        func: new Function(code),
        world: "MAIN",
    });
}

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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found");
    return tab.id;
}

async function sendToContentScript(tabId, message) {
    let response;
    try {
        response = await chrome.tabs.sendMessage(tabId, message);
    } catch {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"],
        });
        response = await chrome.tabs.sendMessage(tabId, message);
    }
    if (response && response.__error) {
        throw new Error(response.__error);
    }
    return response;
}

async function executeInPage(tabId, code) {
    const escaped = JSON.stringify(code);
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (escapedCode) => {
            try {
                const __r = eval(escapedCode);
                return { success: true, data: __r };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },
        args: [code],
        world: "MAIN",
    });
    return results?.[0]?.result;
}

async function handleRequest(request) {
    const { action, params } = request;

    switch (action) {
        case "tabs.list": {
            const tabs = await chrome.tabs.query({});
            return tabs.map((t) => ({
                id: t.id,
                url: t.url,
                title: t.title,
                active: t.active,
                windowId: t.windowId,
            }));
        }

        case "tabs.open": {
            const tab = await chrome.tabs.create({ url: params.url });
            return { id: tab.id, url: tab.url, title: tab.title };
        }

        case "tabs.close": {
            await chrome.tabs.remove(params.tabId);
            return null;
        }

        case "tabs.navigate": {
            const tabId = await getTargetTabId(params);
            const tab = await chrome.tabs.update(tabId, { url: params.url });
            return { id: tab.id, url: tab.url, title: tab.title };
        }

        case "tabs.activate": {
            const tab = await chrome.tabs.update(params.tabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
            return null;
        }

        case "capture.screenshot": {
            const tabId = await getTargetTabId(params);
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.update(tabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
            await new Promise((r) => setTimeout(r, 100));
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
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
            const result = await executeInPage(tabId, params.code);
            if (!result) throw new Error("Script execution returned no result");
            if (!result.success) throw new Error(result.error);
            return result.data;
        }

        case "tabs.goBack": {
            const tabId = await getTargetTabId(params);
            await chrome.tabs.goBack(tabId);
            return null;
        }

        case "tabs.goForward": {
            const tabId = await getTargetTabId(params);
            await chrome.tabs.goForward(tabId);
            return null;
        }

        case "tabs.reload": {
            const tabId = await getTargetTabId(params);
            await chrome.tabs.reload(tabId);
            return null;
        }

        case "cookies.get": {
            const cookies = await chrome.cookies.getAll({ url: params.url });
            return cookies.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                secure: c.secure,
                httpOnly: c.httpOnly,
                expirationDate: c.expirationDate,
            }));
        }

        case "cookies.set": {
            const cookie = await chrome.cookies.set({
                url: params.url,
                name: params.name,
                value: params.value,
                domain: params.domain,
                path: params.path || "/",
                secure: params.secure,
                httpOnly: params.httpOnly,
                expirationDate: params.expirationDate,
            });
            return cookie;
        }

        case "cookies.delete": {
            await chrome.cookies.remove({ url: params.url, name: params.name });
            return null;
        }

        case "dialog.setBehavior": {
            const tabId = await getTargetTabId(params);
            dialogState.behavior = {
                action: params.action || "dismiss",
                text: params.text,
            };
            const behaviorCode = `window.__dialogBehavior = ${JSON.stringify(dialogState.behavior)};`;
            await setupDialogOverride(tabId);
            await chrome.scripting.executeScript({
                target: { tabId },
                func: (code) => eval(code),
                args: [behaviorCode],
                world: "MAIN",
            });
            return null;
        }

        case "dialog.getLast": {
            const tabId = await getTargetTabId(params);
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => window.__lastDialog || null,
                world: "MAIN",
            });
            return results?.[0]?.result || null;
        }

        case "wait.navigation": {
            const tabId = await getTargetTabId(params);
            const timeout = params.timeout || 30000;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    reject(new Error(`Navigation timed out after ${timeout}ms`));
                }, timeout);

                function listener(updatedTabId, changeInfo) {
                    if (updatedTabId === tabId && changeInfo.status === "complete") {
                        clearTimeout(timer);
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve(null);
                    }
                }

                chrome.tabs.onUpdated.addListener(listener);
            });
        }

        default: {
            if (
                action.startsWith("dom.") ||
                action.startsWith("interaction.") ||
                action.startsWith("wait.") ||
                action.startsWith("storage.") ||
                action.startsWith("monitor.") ||
                action === "capture.annotate" ||
                action === "capture.clearAnnotations" ||
                action === "capture.highlight" ||
                action === "capture.elementRect" ||
                action === "capture.metrics"
            ) {
                const tabId = await getTargetTabId(params);
                return sendToContentScript(tabId, { action, params });
            }
            throw new Error(`Unknown action: ${action}`);
        }
    }
}

connect();
