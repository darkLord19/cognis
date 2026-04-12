import { RunManager } from "../core/run-manager";
import { RunSupervisor } from "../core/run-supervisor";
import { WorldConfigManager } from "../core/world-config-manager";
import { db } from "../persistence/database";
import { InterventionPipeline } from "./intervention-pipeline";

const runSupervisor = new RunSupervisor();
const interventionPipeline = new InterventionPipeline(runSupervisor);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function setApiDependencies(_deps: {
  eventBus: import("../core/event-bus").EventBus;
  clock: import("../core/sim-clock").SimClock;
  gateway: import("../llm/gateway").LLMGateway;
  speciesRegistry: import("../species/registry").SpeciesRegistry;
}): void {}

export function startManagementApi(port: number): void {
  Bun.serve({
    port,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      if (path === "/runs" && method === "GET") {
        return jsonResponse({ runs: RunManager.listRuns() });
      }

      if (path === "/runs" && method === "POST") {
        const body = await req.json().catch(() => null);
        if (!body) return jsonResponse({ error: "Invalid JSON" }, 400);

        const runId = `run-${Date.now()}`;
        RunManager.createRun(runId, body.name || "Unnamed", 0, body.config);
        return jsonResponse({ id: runId });
      }

      const configMatch = path.match(/^\/runs\/([^/]+)\/config$/);
      if (configMatch && method === "GET") {
        const runId = configMatch[1];
        if (!runId) return jsonResponse({ error: "Run ID required" }, 400);
        return jsonResponse(WorldConfigManager.load(runId, "main", 0, db));
      }

      const agentsMatch = path.match(/^\/runs\/([^/]+)\/agents$/);
      if (agentsMatch && method === "GET") {
        const runId = agentsMatch[1];
        if (!runId) return jsonResponse({ error: "Run ID required" }, 400);
        const runtime = runSupervisor.getRuntime(runId);
        if (!runtime || !runtime.orchestrator) {
          return jsonResponse({ error: "Runtime not active" }, 404);
        }
        return jsonResponse({ agents: runtime.orchestrator.getAgents() });
      }

      const interventionMatch = path.match(/^\/runs\/([^/]+)\/interventions$/);
      if (interventionMatch && method === "POST") {
        const runId = interventionMatch[1];
        const body = await req.json().catch(() => null);
        if (!body || !runId) return jsonResponse({ error: "Invalid request" }, 400);

        const result = interventionPipeline.applyIntervention(
          runId,
          body.agentId,
          body.type,
          body.intensity,
        );
        return jsonResponse(result, result.success ? 200 : 500);
      }

      return jsonResponse({ error: "Not found" }, 404);
    },
  });
}
