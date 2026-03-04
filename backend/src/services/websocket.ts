import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { WsEvent } from "../types";

export class WebSocketService {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        data: { message: "Connected to Autonomous Economy Protocol" },
      }));

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("[WS] Client disconnected");
      });

      ws.on("error", (err) => {
        console.error("[WS] Error:", err.message);
        this.clients.delete(ws);
      });
    });
  }

  broadcast(event: WsEvent) {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  broadcastEvent(type: string, data: Record<string, unknown>) {
    this.broadcast({ type, timestamp: Date.now(), data });
  }

  get clientCount() {
    return this.clients.size;
  }
}
