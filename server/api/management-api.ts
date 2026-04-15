import { EventType } from "../../shared/events";
import type { WorldConfig } from "../../shared/types";
import type { GlassRoomManager } from "../agents/glass-room";
import type { RunService } from "../core/run-service";
import type { RunSupervisor } from "../core/run-supervisor";
import { WorldConfigManager } from "../core/world-config-manager";
import { db } from "../persistence/database";
import { MerkleLogger } from "../persistence/merkle-logger";
import { InterventionPipeline } from "./intervention-pipeline";

type ApiDependencies = {
  glassRoomManager: GlassRoomManager;
  runService: RunService;
  runSupervisor: RunSupervisor;
};

let apiDeps: ApiDependencies | null = null;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function eventStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function getApiDependencies(): ApiDependencies {
  if (!apiDeps) {
    throw new Error("Management API dependencies are not configured.");
  }
  return apiDeps;
}

function parseRequestBody<T>(req: Request): Promise<T | null> {
  return req.json().catch(() => null) as Promise<T | null>;
}

function readInlineConfig(body: Record<string, unknown>): WorldConfig | undefined {
  if (!body.config || typeof body.config !== "object") {
    return undefined;
  }

  return body.config as WorldConfig;
}

function requirePathParam(value: string | undefined): string {
  if (!value) {
    throw new Error("Missing path parameter");
  }
  return value;
}

export function setApiDependencies(deps: ApiDependencies): void {
  apiDeps = deps;
}

export function createManagementApiHandler(deps: ApiDependencies) {
  const interventionPipeline = new InterventionPipeline(deps.runSupervisor);
  const encoder = new TextEncoder();

  return async function handleManagementApi(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (path === "/health" && method === "GET") {
      return jsonResponse(deps.runService.getHealth());
    }

    if (path === "/configs" && method === "GET") {
      return jsonResponse({ configs: deps.runService.listConfigTemplates() });
    }

    if (path === "/metrics" && method === "GET") {
      return jsonResponse(deps.runService.getMetrics());
    }

    if (path === "/runs" && method === "GET") {
      return jsonResponse({ runs: deps.runService.listRuns() });
    }

    if (path === "/runs" && method === "POST") {
      const body = await parseRequestBody<Record<string, unknown>>(req);
      if (!body) {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      try {
        const request: Parameters<RunService["createRun"]>[0] = {};
        if (typeof body.config === "string") request.config = body.config;
        if (typeof body.configPath === "string") request.configPath = body.configPath;
        if (typeof body.name === "string") request.name = body.name;
        if (typeof body.seed === "number") request.seed = body.seed;
        const inlineConfig = readInlineConfig(body);
        if (inlineConfig) request.inlineConfig = inlineConfig;

        const created = deps.runService.createRun(request);
        return jsonResponse(created, 201);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to create run" },
          400,
        );
      }
    }

    if (path === "/triple-baseline" && method === "POST") {
      const body = await parseRequestBody<Record<string, unknown>>(req);
      if (!body) {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      try {
        const request: Parameters<RunService["createTripleBaseline"]>[0] = {};
        if (typeof body.config === "string") request.config = body.config;
        if (typeof body.configPath === "string") request.configPath = body.configPath;
        if (typeof body.name === "string") request.name = body.name;
        if (typeof body.seed === "number") request.seed = body.seed;
        const inlineConfig = readInlineConfig(body);
        if (inlineConfig) request.inlineConfig = inlineConfig;

        return jsonResponse(deps.runService.createTripleBaseline(request), 201);
      } catch (error) {
        return jsonResponse(
          {
            error: error instanceof Error ? error.message : "Failed to create triple baseline runs",
          },
          400,
        );
      }
    }

    const runMatch = path.match(/^\/runs\/([^/]+)$/);
    if (runMatch && method === "GET") {
      const runId = requirePathParam(runMatch[1]);
      const summary = deps.runService.getRunSummary(runId);
      if (!summary) {
        return jsonResponse({ error: "Run not found" }, 404);
      }
      return jsonResponse(summary);
    }

    const startMatch = path.match(/^\/runs\/([^/]+)\/start$/);
    if (startMatch && method === "POST") {
      try {
        return jsonResponse(deps.runService.startRun(requirePathParam(startMatch[1])));
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to start run" },
          404,
        );
      }
    }

    const pauseMatch = path.match(/^\/runs\/([^/]+)\/pause$/);
    if (pauseMatch && method === "POST") {
      try {
        return jsonResponse(deps.runService.pauseRun(requirePathParam(pauseMatch[1])));
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to pause run" },
          404,
        );
      }
    }

    const stopMatch = path.match(/^\/runs\/([^/]+)\/stop$/);
    if (stopMatch && method === "POST") {
      try {
        return jsonResponse(deps.runService.stopRun(requirePathParam(stopMatch[1])));
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to stop run" },
          404,
        );
      }
    }

    const configMatch = path.match(/^\/runs\/([^/]+)\/config$/);
    if (configMatch && method === "GET") {
      try {
        return jsonResponse(deps.runService.getConfig(requirePathParam(configMatch[1])));
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to load config" },
          404,
        );
      }
    }

    if (configMatch && method === "PATCH") {
      const runId = requirePathParam(configMatch[1]);
      const body = await parseRequestBody<Record<string, unknown>>(req);
      if (!body || typeof body.path !== "string") {
        return jsonResponse({ error: "Invalid request" }, 400);
      }

      const latestTick = deps.runService.getRunSummary(runId)?.currentTick ?? 0;

      try {
        WorldConfigManager.mutate(
          runId,
          "main",
          latestTick,
          body.path,
          body.value,
          db,
          MerkleLogger,
          "operator",
        );
        return jsonResponse({
          ok: true,
          config: deps.runService.getConfig(runId, "main", latestTick),
        });
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to mutate config" },
          400,
        );
      }
    }

    const agentsMatch = path.match(/^\/runs\/([^/]+)\/agents$/);
    if (agentsMatch && method === "GET") {
      return jsonResponse({ agents: deps.runService.getAgents(requirePathParam(agentsMatch[1])) });
    }

    const agentMatch = path.match(/^\/runs\/([^/]+)\/agents\/([^/]+)$/);
    if (agentMatch && method === "GET") {
      const runId = requirePathParam(agentMatch[1]);
      const agentId = requirePathParam(agentMatch[2]);
      const agent = deps.runService.getAgents(runId).find((entry) => entry.id === agentId);
      if (!agent) {
        return jsonResponse({ error: "Agent not found" }, 404);
      }
      return jsonResponse(agent);
    }

    const sensorsMatch = path.match(/^\/runs\/([^/]+)\/agents\/([^/]+)\/sensors$/);
    if (sensorsMatch && method === "GET") {
      const runId = requirePathParam(sensorsMatch[1]);
      const agentId = requirePathParam(sensorsMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      if (!runtime?.orchestrator) {
        return jsonResponse({ error: "Run not active" }, 404);
      }
      return jsonResponse({ sensors: runtime.orchestrator.getLatestSensorBundle(agentId) });
    }

    const qualiaMatch = path.match(/^\/runs\/([^/]+)\/agents\/([^/]+)\/qualia$/);
    if (qualiaMatch && method === "GET") {
      const runId = requirePathParam(qualiaMatch[1]);
      const agentId = requirePathParam(qualiaMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      if (!runtime?.orchestrator) {
        return jsonResponse({ error: "Run not active" }, 404);
      }
      return jsonResponse({ qualia: runtime.orchestrator.getLatestQualia(agentId) });
    }

    const actionTraceMatch = path.match(/^\/runs\/([^/]+)\/agents\/([^/]+)\/action-trace$/);
    if (actionTraceMatch && method === "GET") {
      const runId = requirePathParam(actionTraceMatch[1]);
      const agentId = requirePathParam(actionTraceMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      if (!runtime?.orchestrator) {
        return jsonResponse({ error: "Run not active" }, 404);
      }
      return jsonResponse({ trace: runtime.orchestrator.getActionTrace(agentId, 100) });
    }

    const proceduralMemoryMatch = path.match(
      /^\/runs\/([^/]+)\/agents\/([^/]+)\/procedural-memory$/,
    );
    if (proceduralMemoryMatch && method === "GET") {
      const runId = requirePathParam(proceduralMemoryMatch[1]);
      const agentId = requirePathParam(proceduralMemoryMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      const summary = deps.runService.getRunSummary(runId);
      if (!summary) {
        return jsonResponse({ error: "Run not found" }, 404);
      }
      return jsonResponse({
        affordances: runtime?.orchestrator?.getProceduralMemory(agentId) ?? [],
        outcomes: deps.runService.getProceduralOutcomes(runId, agentId, "main", 200),
      });
    }

    const findingsMatch = path.match(/^\/runs\/([^/]+)\/findings$/);
    if (findingsMatch && method === "GET") {
      try {
        return jsonResponse({
          findings: deps.runService.getFindings(requirePathParam(findingsMatch[1])),
        });
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to load findings" },
          404,
        );
      }
    }

    const auditMatch = path.match(/^\/runs\/([^/]+)\/audit$/);
    if (auditMatch && method === "GET") {
      const runId = requirePathParam(auditMatch[1]);
      const fromTick = url.searchParams.get("fromTick");
      const toTick = url.searchParams.get("toTick");

      try {
        return jsonResponse({
          entries: deps.runService.getAuditLog(
            runId,
            "main",
            fromTick ? Number(fromTick) : undefined,
            toTick ? Number(toTick) : undefined,
          ),
        });
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to load audit log" },
          404,
        );
      }
    }

    const auditVerifyMatch = path.match(/^\/runs\/([^/]+)\/audit\/verify$/);
    if (auditVerifyMatch && method === "POST") {
      const runId = requirePathParam(auditVerifyMatch[1]);

      try {
        return jsonResponse(deps.runService.verifyAudit(runId));
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to verify audit log" },
          404,
        );
      }
    }

    const branchMatch = path.match(/^\/runs\/([^/]+)\/branch$/);
    if (branchMatch && method === "POST") {
      const runId = requirePathParam(branchMatch[1]);
      const body = await parseRequestBody<Record<string, unknown>>(req);

      try {
        const branch = deps.runService.createBranch(
          runId,
          body && typeof body.name === "string" ? body.name : undefined,
        );
        return jsonResponse(branch, 201);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Failed to create branch" },
          404,
        );
      }
    }

    const watchMatch = path.match(/^\/runs\/([^/]+)\/watch$/);
    if (watchMatch && method === "GET") {
      const runId = requirePathParam(watchMatch[1]);
      const summary = deps.runService.getRunSummary(runId);
      if (!summary) {
        return jsonResponse({ error: "Run not found" }, 404);
      }

      const runtime = deps.runService.getRuntime(runId);
      let cleanup = () => {};

      const stream = new ReadableStream<Uint8Array>({
        cancel() {
          cleanup();
        },
        start(controller) {
          const writeEvent = (event: string, payload: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
            );
          };

          writeEvent("snapshot", {
            runId,
            status: summary.status,
            tick: summary.currentTick,
            agents: deps.runService.getAgents(runId),
          });

          if (!runtime) {
            controller.close();
            return;
          }

          const eventHandler = (event: unknown) => {
            writeEvent("event", event);
            if (
              typeof event === "object" &&
              event !== null &&
              "type" in event &&
              event.type === EventType.TICK
            ) {
              writeEvent("tick", {
                runId,
                tick: runtime.clock.getTick(),
                status: runtime.status,
              });
            }
          };

          runtime.eventBus.onAny(eventHandler);

          cleanup = () => {
            runtime.eventBus.offAny(eventHandler);
            unsubscribe();
          };

          const unsubscribe = deps.runSupervisor.onRuntimeEvent((event) => {
            if (event.type === "stopped" && event.runId === runId) {
              cleanup();
              controller.close();
            }
            if (event.type === "shutdown") {
              cleanup();
              controller.close();
            }
          });
        },
      });

      return eventStreamResponse(stream);
    }

    const interventionMatch = path.match(/^\/runs\/([^/]+)\/interventions$/);
    if (interventionMatch && method === "POST") {
      const runId = requirePathParam(interventionMatch[1]);
      const body = await parseRequestBody<Record<string, unknown>>(req);
      if (
        !body ||
        typeof body.agentId !== "string" ||
        typeof body.type !== "string" ||
        typeof body.intensity !== "number"
      ) {
        return jsonResponse({ error: "Invalid request" }, 400);
      }

      const result = interventionPipeline.applyIntervention(
        runId,
        body.agentId,
        body.type,
        body.intensity,
      );
      return jsonResponse(result, result.success || result.resisted ? 200 : 400);
    }

    const glassRoomMatch = path.match(/^\/runs\/([^/]+)\/glass-room\/([^/]+)$/);
    if (glassRoomMatch && method === "POST") {
      const runId = requirePathParam(glassRoomMatch[1]);
      const agentId = requirePathParam(glassRoomMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      const agent = deps.runService.getAgents(runId).find((entry) => entry.id === agentId);
      if (!runtime?.orchestrator || !agent) {
        return jsonResponse({ error: "Runtime or agent not found" }, 404);
      }

      agent.currentAction = { type: "REST" };
      const session = deps.glassRoomManager.enterGlassRoom(runId, agentId, runtime.clock.getTick());
      runtime.eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: runtime.branchId,
        run_id: runId,
        tick: runtime.clock.getTick(),
        type: EventType.GLASS_ROOM_ENTERED,
        agent_id: agentId,
        payload: { startTick: session.startTick },
      });
      return jsonResponse({ ok: true, session });
    }

    if (glassRoomMatch && method === "DELETE") {
      const runId = requirePathParam(glassRoomMatch[1]);
      const agentId = requirePathParam(glassRoomMatch[2]);
      const runtime = deps.runService.getRuntime(runId);
      if (!runtime?.orchestrator) {
        return jsonResponse({ error: "Runtime not found" }, 404);
      }

      deps.glassRoomManager.exitGlassRoom(runId, agentId);
      runtime.eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: runtime.branchId,
        run_id: runId,
        tick: runtime.clock.getTick(),
        type: EventType.GLASS_ROOM_EXITED,
        agent_id: agentId,
        payload: {},
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Not found" }, 404);
  };
}

export function startManagementApi(port: number): void {
  const deps = getApiDependencies();

  Bun.serve({
    port,
    fetch: createManagementApiHandler(deps),
  });
}
