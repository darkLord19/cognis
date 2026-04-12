import type { ServerWebSocket } from "bun";
import { EventType, type SimEvent } from "../../shared/events";
import type {
  AgentState,
  AuditLogEntry,
  WSClientCommand,
  WSClientSubscribeCommand,
} from "../../shared/types";
import type { RunSupervisor } from "../core/run-supervisor";
import { db } from "../persistence/database";
import { authenticateOperator } from "./auth";

type RunSubscription = {
  eventTypes?: Set<string>;
  agentIds?: Set<string>;
  includeInnerMonologue: boolean;
  includeAudit: boolean;
};

interface WSData {
  isOperator: boolean;
  subscriptions: Map<string, RunSubscription>;
}

export class WebSocketServer {
  private sockets: Set<ServerWebSocket<WSData>> = new Set();
  private operatorToken: string | undefined;
  private server: ReturnType<typeof Bun.serve<WSData>> | null = null;
  private runtimeUnsubscribe: (() => void) | null;
  private eventHandlers: Map<string, (event: SimEvent) => void> = new Map();

  constructor(private runSupervisor: RunSupervisor) {
    this.operatorToken = process.env.OPERATOR_TOKEN;

    for (const runtime of this.runSupervisor.listRuntimes()) {
      this.attachRuntime(runtime.runId);
    }

    this.runtimeUnsubscribe = this.runSupervisor.onRuntimeEvent((event) => {
      if (event.type === "registered") {
        this.attachRuntime(event.runtime.runId);
      }
      if (event.type === "stopped") {
        this.detachRuntime(event.runId);
      }
      if (event.type === "shutdown") {
        for (const runId of this.eventHandlers.keys()) {
          this.detachRuntime(runId);
        }
      }
    });
  }

  public start(port = 3001): number {
    this.server = Bun.serve<WSData>({
      port,
      fetch(req, server) {
        if (server.upgrade(req, { data: { isOperator: false, subscriptions: new Map() } })) {
          return;
        }
        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        open: (ws) => {
          this.sockets.add(ws);
        },
        message: (ws, message) => {
          try {
            const data = JSON.parse(String(message)) as WSClientCommand;
            if (data.type === "subscribe") {
              this.handleSubscribe(ws, data);
            } else if (data.type === "AUTH_OPERATOR" || data.type === "auth_operator") {
              ws.data.isOperator = authenticateOperator(data.token, this.operatorToken);
            }
          } catch {
            // Ignore malformed websocket frames.
          }
        },
        close: (ws) => {
          this.sockets.delete(ws);
        },
      },
    });
    const activePort = this.server.port ?? port;
    console.log(`WebSocket server started on port ${activePort}`);
    return activePort;
  }

  public stop(): void {
    this.server?.stop(true);
    this.server = null;
    this.runtimeUnsubscribe?.();
    this.runtimeUnsubscribe = null;
  }

  private handleSubscribe(ws: ServerWebSocket<WSData>, data: WSClientSubscribeCommand): void {
    ws.data.subscriptions.set(data.runId, {
      ...(data.eventTypes ? { eventTypes: new Set(data.eventTypes) } : {}),
      ...(data.agentIds ? { agentIds: new Set(data.agentIds) } : {}),
      includeInnerMonologue: data.includeInnerMonologue ?? false,
      includeAudit: data.includeAudit ?? false,
    });

    this.attachRuntime(data.runId);
    const runtime = this.runSupervisor.getRuntime(data.runId);
    if (!runtime) {
      return;
    }

    ws.send(
      JSON.stringify({
        type: "snapshot",
        runId: data.runId,
        status: runtime.status,
        tick: runtime.clock.getTick(),
        agents: runtime.agents,
      }),
    );
  }

  private attachRuntime(runId: string): void {
    if (this.eventHandlers.has(runId)) {
      return;
    }

    const runtime = this.runSupervisor.getRuntime(runId);
    if (!runtime) {
      return;
    }

    const handler = (event: SimEvent) => {
      this.dispatchEvent(runId, event);
    };
    runtime.eventBus.onAny(handler);
    this.eventHandlers.set(runId, handler);
  }

  private detachRuntime(runId: string): void {
    const handler = this.eventHandlers.get(runId);
    const runtime = this.runSupervisor.getRuntime(runId);
    if (handler && runtime) {
      runtime.eventBus.offAny(handler);
    }
    this.eventHandlers.delete(runId);
  }

  private dispatchEvent(runId: string, event: SimEvent): void {
    const runtime = this.runSupervisor.getRuntime(runId);
    const lastAuditEntry =
      event.type === EventType.INTERVENTION_APPLIED ||
      event.type === EventType.INTERVENTION_RESISTED
        ? (db.getAuditLogs(event.branch_id).at(-1) as AuditLogEntry | undefined)
        : undefined;

    for (const socket of this.sockets) {
      const subscription = socket.data.subscriptions.get(runId);
      if (!subscription) {
        continue;
      }
      if (subscription.eventTypes && !subscription.eventTypes.has(event.type)) {
        continue;
      }
      if (subscription.agentIds && event.agent_id && !subscription.agentIds.has(event.agent_id)) {
        continue;
      }

      socket.send(JSON.stringify({ type: "event", runId, event }));

      if (event.type === EventType.TICK) {
        socket.send(
          JSON.stringify({
            type: "tick",
            runId,
            tick: event.tick,
            status: runtime?.status ?? "created",
          }),
        );
      }

      const agent = event.agent_id ? this.findAgent(runtime?.agents, event.agent_id) : null;
      if (agent) {
        socket.send(JSON.stringify({ type: "agent_update", runId, agent }));
      }

      if (socket.data.isOperator && subscription.includeInnerMonologue && agent?.innerMonologue) {
        socket.send(
          JSON.stringify({
            type: "inner_monologue",
            runId,
            agentId: agent.id,
            tick: event.tick,
            innerMonologue: agent.innerMonologue,
          }),
        );
      }

      if (socket.data.isOperator && subscription.includeAudit && lastAuditEntry) {
        socket.send(JSON.stringify({ type: "audit_entry", runId, entry: lastAuditEntry }));
      }
    }
  }

  private findAgent(agents: AgentState[] | undefined, agentId: string): AgentState | null {
    return agents?.find((agent) => agent.id === agentId) ?? null;
  }
}
