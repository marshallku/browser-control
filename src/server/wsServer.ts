import { WebSocketServer, WebSocket } from "ws";

const DEFAULT_PORT = 7865;

let wss: WebSocketServer | null = null;
let activeSocket: WebSocket | null = null;
let messageHandler: ((data: string) => void) | null = null;

export function getActiveSocket(): WebSocket | null {
  return activeSocket;
}

export function setMessageHandler(handler: (data: string) => void): void {
  messageHandler = handler;
}

export function startWsServer(): WebSocketServer {
  const port = parseInt(
    process.env.BROWSER_CONTROL_PORT ?? String(DEFAULT_PORT),
    10,
  );
  wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
      activeSocket.close();
    }
    activeSocket = ws;
    console.error(`[ws] Extension connected`);

    ws.on("message", (raw) => {
      messageHandler?.(raw.toString());
    });

    ws.on("close", () => {
      if (activeSocket === ws) {
        activeSocket = null;
        console.error(`[ws] Extension disconnected`);
      }
    });

    ws.on("error", (err) => {
      console.error(`[ws] Error:`, err.message);
    });

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30_000);

    ws.on("close", () => clearInterval(heartbeat));
  });

  wss.on("listening", () => {
    console.error(`[ws] Listening on ws://localhost:${port}`);
  });

  return wss;
}

export function stopWsServer(): void {
  activeSocket?.close();
  activeSocket = null;
  wss?.close();
  wss = null;
}
