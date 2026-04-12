import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorldConfig } from "../../shared/types";
import { RunContext } from "../core/run-context";
import { RunManager, type RunRecord } from "../core/run-manager";
import { WorldConfigManager } from "../core/world-config-manager";
import { db } from "../persistence/database";
import { FindingsJournal } from "../research/findings-journal";

interface CreateRunRequest {
  config?: string;
  configPath?: string;
  name?: string;
  seed?: number;
}

let eventBusInstance: import("../core/event-bus").EventBus | null = null;
let clockInstance: import("../core/sim-clock").SimClock | null = null;
let gatewayInstance: import("../llm/gateway").LLMGateway | null = null;
let speciesRegistryInstance: import("../species/registry").SpeciesRegistry | null = null;

export function setApiDependencies(deps: {
  eventBus: import("../core/event-bus").EventBus;
  clock: import("../core/sim-clock").SimClock;
  gateway: import("../llm/gateway").LLMGateway;
  speciesRegistry: import("../species/registry").SpeciesRegistry;
}): void {
  eventBusInstance = deps.eventBus;
  clockInstance = deps.clock;
  gatewayInstance = deps.gateway;
  speciesRegistryInstance = deps.speciesRegistry;
}

async function startRunFromApi(runId: string): Promise<{ success: boolean; error?: string }> {
  if (!eventBusInstance || !clockInstance || !gatewayInstance || !speciesRegistryInstance) {
    return { success: false, error: "Server not fully initialized" };
  }

  const run = RunManager.getRun(runId);
  if (!run) {
    return { success: false, error: "Run not found" };
  }

  try {
    const config = WorldConfigManager.load(runId, "main", 0, db);
    const { bootstrapSimulation } = await import("../core/bootstrap");
    const { orchestrator, agents, world } = bootstrapSimulation(config, {
      eventBus: eventBusInstance,
      clock: clockInstance,
      gateway: gatewayInstance,
      speciesRegistry: speciesRegistryInstance,
      database: db,
    });

    RunContext.set({
      runId,
      branchId: "main",
      config,
      world,
      orchestrator,
      clock: clockInstance,
      eventBus: eventBusInstance,
      agents,
      status: "running",
    });

    clockInstance.start(
      config.time || { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 100 },
    );

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function parseBody(req: Request): Promise<CreateRunRequest | null> {
  if (req.headers.get("content-type")?.includes("application/json")) {
    return req.json().catch(() => null);
  }
  return Promise.resolve(null);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function loadConfig(nameOrPath: string): WorldConfig | null {
  if (existsSync(nameOrPath)) {
    try {
      return JSON.parse(readFileSync(nameOrPath, "utf8")) as WorldConfig;
    } catch {
      return null;
    }
  }

  const builtInPath = join(import.meta.dir, "../../data/world-configs", `${nameOrPath}.json`);
  if (existsSync(builtInPath)) {
    try {
      return JSON.parse(readFileSync(builtInPath, "utf8")) as WorldConfig;
    } catch {
      return null;
    }
  }

  return null;
}

export function startManagementApi(port: number): void {
  Bun.serve({
    port,
    async fetch(req, server): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      if (path === "/runs" && method === "GET") {
        const runs = RunManager.listRuns();
        return jsonResponse({
          runs: runs.map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            startTick: r.start_tick,
            endTick: r.end_tick,
            currentTick: r.current_tick,
          })),
        });
      }

      if (path === "/runs" && method === "POST") {
        return parseBody(req).then((body) => {
          if (!body) {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
          }

          const configName = body.config || body.configPath || "earth-default";
          const config = loadConfig(configName);

          if (!config) {
            return jsonResponse({ error: `Config not found: ${configName}` }, 404);
          }

          if (body.seed !== undefined) {
            config.meta.seed = body.seed;
          }
          if (body.name) {
            config.meta.name = body.name;
          }

          const configHash = config.meta.seed.toString(36).slice(0, 12);
          const runId = `run-${config.meta.seed}-${configHash}`;
          const existing = RunManager.getRun(runId);

          if (existing) {
            return jsonResponse({
              id: existing.id,
              status: existing.status,
              currentTick: (existing as RunRecord).current_tick,
            });
          }

          RunManager.createRun(runId, config.meta.name, 0, config);
          WorldConfigManager.create(config, runId, db);

          return jsonResponse({
            id: runId,
            status: "created",
            name: config.meta.name,
            seed: config.meta.seed,
          });
        });
      }

      const runMatch = path.match(/^\/runs\/([^/]+)$/);
      if (runMatch) {
        const runId = runMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);

        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        if (method === "GET") {
          const ctx = RunContext.get();
          const isActiveRun = ctx?.runId === runId;

          return jsonResponse({
            id: run.id,
            name: run.name,
            status: run.status,
            startTick: run.start_tick,
            endTick: run.end_tick,
            currentTick: isActiveRun ? ctx.clock.getTick() : (run as RunRecord).current_tick,
            agentCount: isActiveRun ? ctx.agents.length : 0,
          });
        }
      }

      const startMatch = path.match(/^\/runs\/([^/]+)\/start$/);
      if (startMatch) {
        const runId = startMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);

        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        const result = await startRunFromApi(runId);
        if (!result.success) {
          return jsonResponse({ error: result.error }, 500);
        }

        RunManager.updateRunStatus(runId, "running");
        const currentTick = RunContext.get()?.clock.getTick() ?? 0;

        return jsonResponse({
          status: "running",
          currentTick,
        });
      }

      const pauseMatch = path.match(/^\/runs\/([^/]+)\/pause$/);
      if (pauseMatch) {
        const runId = pauseMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);

        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        RunManager.updateRunStatus(runId, "paused");
        RunContext.updateStatus("paused");

        const ctx = RunContext.get();
        if (ctx) {
          ctx.clock.pause();
        }

        return jsonResponse({ status: "paused" });
      }

      const resumeMatch = path.match(/^\/runs\/([^/]+)\/resume$/);
      if (resumeMatch) {
        const runId = resumeMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);

        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        RunManager.updateRunStatus(runId, "running");
        RunContext.updateStatus("running");

        const ctx = RunContext.get();
        if (ctx) {
          ctx.clock.resume();
        }

        return jsonResponse({ status: "running" });
      }

      const stopMatch = path.match(/^\/runs\/([^/]+)\/stop$/);
      if (stopMatch) {
        const runId = stopMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);

        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        const ctx = RunContext.get();
        const tick = ctx?.clock.getTick() ?? 0;

        RunManager.stopRun(runId, tick);
        RunContext.updateStatus("stopped");

        return jsonResponse({ status: "stopped", tick });
      }

      const findingsMatch = path.match(/^\/runs\/([^/]+)\/findings$/);
      if (findingsMatch && method === "GET") {
        const runId = findingsMatch[1];
        if (!runId) {
          return jsonResponse({ error: "Run ID is required" }, 400);
        }
        const run = RunManager.getRun(runId);
        if (!run) {
          return jsonResponse({ error: "Run not found" }, 404);
        }

        const findings = FindingsJournal.getFindings("main");

        return jsonResponse({
          findings: findings.map((f) => ({
            id: f.id,
            tick: f.tick,
            description: f.description,
            phenomenon: f.phenomenon,
            interpretation: f.interpretation,
          })),
        });
      }

      if (path === "/health" && method === "GET") {
        return jsonResponse({ status: "ok" });
      }

      return jsonResponse({ error: "Not found" }, 404);
    },
  });

  console.log(`Management API running on http://localhost:${port}`);
}
