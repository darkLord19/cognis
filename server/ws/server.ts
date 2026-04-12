import type { ServerWebSocket } from "bun";
import type { SimEvent } from "../../shared/events";
import { EventType } from "../../shared/events";
import type { EventBus } from "../core/event-bus";
import { MerkleLogger } from "../persistence/merkle-logger";
import { TripleBaseline } from "../research/triple-baseline";

interface WSData {
  isOperator: boolean;
}

/** Event types that contain inner monologue or suppressed data — operator only. */
const _OPERATOR_ONLY_EVENT_TYPES: Set<string> = new Set([
  EventType.TICK, // TICK events may carry qualia in payload — filter innerMonologue
]);

/** Fields in event payloads that must be stripped for non-operator. */
const SENSITIVE_PAYLOAD_FIELDS = ["innerMonologue", "suppressed", "auditEntry"];

function sanitizeEventForPublic(event: SimEvent): SimEvent {
  // If it's a System2 inner monologue log, suppress entirely for non-operators
  if (event.payload && typeof event.payload === "object" && "innerMonologue" in event.payload) {
    const cleaned = { ...event.payload };
    for (const field of SENSITIVE_PAYLOAD_FIELDS) {
      delete (cleaned as Record<string, unknown>)[field];
    }
    return { ...event, payload: cleaned };
  }
  return event;
}

export class WebSocketServer {
  private sockets: Set<ServerWebSocket<WSData>> = new Set();

  constructor(private eventBus: EventBus) {
    this.eventBus.onAny((event) => {
      for (const ws of this.sockets) {
        if (ws.data.isOperator) {
          // Operators get everything
          ws.send(JSON.stringify({ type: "EVENT", payload: event }));
        } else {
          // Public connections get sanitised events
          const sanitized = sanitizeEventForPublic(event);
          ws.send(JSON.stringify({ type: "EVENT", payload: sanitized }));
        }
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
              ws.send(JSON.stringify({ type: "AUTH_RESULT", payload: { authenticated: true } }));
              return;
            }

            // All commands below require operator status
            if (!ws.data.isOperator) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  payload: { message: "Operator authentication required" },
                }),
              );
              return;
            }

            if (data.type === "VERIFY_CHAIN") {
              const result = MerkleLogger.verifyChain(data.branchId);
              ws.send(JSON.stringify({ type: "VERIFICATION_RESULT", payload: result }));
            }
            if (data.type === "START_BASELINE") {
              TripleBaseline.spawn(data.config);
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
