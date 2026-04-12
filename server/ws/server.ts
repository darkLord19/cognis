import type { ServerWebSocket } from "bun";
import type { EventBus } from "../core/event-bus";
import { MerkleLogger } from "../persistence/merkle-logger";
import { TripleBaseline } from "../research/triple-baseline";

interface WSData {
  isOperator: boolean;
}

export class WebSocketServer {
  private sockets: Set<ServerWebSocket<WSData>> = new Set();

  constructor(private eventBus: EventBus) {
    this.eventBus.onAny((event) => {
      const msg = JSON.stringify({ type: "EVENT", payload: event });
      for (const ws of this.sockets) {
        ws.send(msg);
      }
    });
  }

  public start(port = 3001) {
    const self = this;
    Bun.serve<WSData>({
      port,
      fetch(req, server) {
        if (server.upgrade(req, { data: { isOperator: false } })) {
          return;
        }
        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        open(ws) {
          self.sockets.add(ws);
        },
        message(ws, message) {
          try {
            const data = JSON.parse(String(message));
            if (data.type === "AUTH_OPERATOR") {
              ws.data.isOperator = true;
              return;
            }

            if (ws.data.isOperator) {
              if (data.type === "VERIFY_CHAIN") {
                const result = MerkleLogger.verifyChain(data.branchId);
                ws.send(JSON.stringify({ type: "VERIFICATION_RESULT", payload: result }));
              }
              if (data.type === "START_BASELINE") {
                TripleBaseline.spawn(data.config);
              }
            }
          } catch (e) {
            console.error("WS message error:", e);
          }
        },
        close(ws) {
          self.sockets.delete(ws);
        },
      },
    });
    console.log(`WebSocket server started on port ${port}`);
  }
}
