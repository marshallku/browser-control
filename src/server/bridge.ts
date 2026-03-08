import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import type {
  BridgeAction,
  BridgeRequest,
  BridgeResponse,
} from "../shared/protocol.js";
import { getActiveSocket, setMessageHandler } from "./wsServer.js";

const TIMEOUT_DEFAULT = 10_000;
const TIMEOUT_LONG = 30_000;

const LONG_TIMEOUT_ACTIONS: Set<BridgeAction> = new Set([
  "capture.screenshot",
  "execution.executeJs",
  "interaction.fillSecure",
  "interaction.type",
  "credentials.fill",
]);

const pendingRequests = new Map<
  string,
  {
    resolve: (response: BridgeResponse) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

export function initBridge(): void {
  setMessageHandler((raw) => {
    let response: BridgeResponse;
    try {
      response = JSON.parse(raw);
    } catch {
      console.error("[bridge] Invalid JSON from extension:", raw);
      return;
    }

    const pending = pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(response.id);
      pending.resolve(response);
    }
  });
}

export function send(
  action: BridgeAction,
  params: Record<string, unknown> = {},
): Promise<BridgeResponse> {
  const socket = getActiveSocket();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.resolve({
      id: "",
      success: false,
      error:
        "Browser extension not connected. Make sure the extension is installed and running.",
    });
  }

  const id = randomUUID();
  const timeout = LONG_TIMEOUT_ACTIONS.has(action)
    ? TIMEOUT_LONG
    : TIMEOUT_DEFAULT;

  const request: BridgeRequest = { id, action, params };

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      resolve({
        id,
        success: false,
        error: `Request timed out after ${timeout}ms`,
      });
    }, timeout);

    pendingRequests.set(id, { resolve, timer });
    socket.send(JSON.stringify(request));
  });
}
