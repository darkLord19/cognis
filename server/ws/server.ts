import type { ServerWebSocket } from "bun";
import type { RunSupervisor } from "../core/run-supervisor";
import { authenticateOperator } from "./auth";

interface WSData {
  isOperator: boolean;
  subscriptions: Set<string>;
}

export class WebSocketServer {
  private sockets: Set<ServerWebSocket<WSData>> = new Set();
  private operatorToken: string | undefined;

  constructor(private runSupervisor: RunSupervisor) {
    this.operatorToken = process.env.OPERATOR_TOKEN;
  }

  public start(port = 3001) {
    Bun.serve<WSData>({
      port,
      fetch(req, server) {
        if (server.upgrade(req, { data: { isOperator: false, subscriptions: new Set() } })) {
          return;
        }
        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        open: (ws) => {
          this.sockets.add(ws);
        },
        message: (ws, message) => {
          const data = JSON.parse(String(message));
          if (data.type === "subscribe") {
            ws.data.subscriptions.add(data.runId);
            const runtime = this.runSupervisor.getRuntime(data.runId);
            if (runtime && runtime.orchestrator) {
              ws.send(
                JSON.stringify({
                  type: "snapshot",
                  runState: "active",
                  agentSummaries: runtime.orchestrator.getAgents(),
                }),
              );
            }
          }
          if (data.type === "AUTH_OPERATOR") {
            ws.data.isOperator = authenticateOperator(data.token, this.operatorToken);
          }
        },
        close: (ws) => {
          this.sockets.delete(ws);
        },
      },
    });
    console.log(`WebSocket server started on port ${port}`);
  }
}
