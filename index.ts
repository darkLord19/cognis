import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setApiDependencies, startManagementApi } from "./server/api/management-api";
import { Watcher } from "./server/api/watcher";
import { bootstrapSimulation } from "./server/core/bootstrap";
import { EventBus } from "./server/core/event-bus";
import { RunContext } from "./server/core/run-context";
import { RunManager } from "./server/core/run-manager";
import { SimClock } from "./server/core/sim-clock";
import { LLMGateway } from "./server/llm/gateway";
import { db } from "./server/persistence/database";
import { SpeciesRegistry } from "./server/species/registry";
import { WebSocketServer } from "./server/ws/server";
import type { WorldConfig } from "./shared/types";

interface CliFlags {
  config?: string;
  configName?: string;
  watch: boolean;
  resume?: string;
  port: number;
  wsPort: number;
}

function parseArgs(): CliFlags {
  const flags: CliFlags = {
    watch: false,
    port: 3000,
    wsPort: 3001,
  };

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--config" && i + 1 < args.length) {
      const value = args[++i];
      if (value !== undefined) {
        flags.config = value;
      }
    } else if (arg === "--config-name" && i + 1 < args.length) {
      const value = args[++i];
      if (value !== undefined) {
        flags.configName = value;
      }
    } else if (arg === "--watch") {
      flags.watch = true;
    } else if (arg === "--resume" && i + 1 < args.length) {
      const value = args[++i];
      if (value !== undefined) {
        flags.resume = value;
      }
    } else if (arg === "--port" && i + 1 < args.length) {
      const value = args[++i];
      if (value !== undefined) {
        flags.port = parseInt(value, 10);
      }
    } else if (arg === "--ws-port" && i + 1 < args.length) {
      const value = args[++i];
      if (value !== undefined) {
        flags.wsPort = parseInt(value, 10);
      }
    }
  }

  return flags;
}

function loadConfig(nameOrPath: string): WorldConfig | null {
  if (existsSync(nameOrPath)) {
    try {
      return JSON.parse(readFileSync(nameOrPath, "utf8")) as WorldConfig;
    } catch {
      return null;
    }
  }

  const builtInPath = join(import.meta.dir, "data/world-configs", `${nameOrPath}.json`);
  if (existsSync(builtInPath)) {
    try {
      return JSON.parse(readFileSync(builtInPath, "utf8")) as WorldConfig;
    } catch {
      return null;
    }
  }

  return null;
}

let watcher: Watcher | null = null;

async function shutdown() {
  console.log("\nShutting down...");

  const ctx = RunContext.get();
  if (ctx && ctx.status === "running") {
    console.log("Pausing simulation...");
    ctx.clock.pause();
    const tick = ctx.clock.getTick();
    RunManager.stopRun(ctx.runId, tick);
    RunContext.updateStatus("stopped");
  }

  if (watcher) {
    watcher.stop();
  }

  console.log("Flushing database...");
  db.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");

  console.log("Goodbye.");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const flags = parseArgs();

console.log("=== Cognis Server ===\n");

const eventBus = new EventBus();
const clock = new SimClock(async (_tick) => {
  const ctx = RunContext.get();
  if (ctx) {
    await ctx.orchestrator.tick();
    const currentTick = ctx.clock.getTick();
    RunManager.updateCurrentTick(ctx.runId, currentTick);
  }
});
const gateway = new LLMGateway();

const speciesRegistry = new SpeciesRegistry();
try {
  speciesRegistry.loadAll();
} catch {
  console.warn("No species data found — using defaults.");
}

const ws = new WebSocketServer(eventBus);
ws.start(flags.wsPort);

startManagementApi(flags.port);
setApiDependencies({ eventBus, clock, gateway, speciesRegistry });

if (flags.resume) {
  const run = RunManager.getRun(flags.resume);
  if (!run) {
    console.error(`Run not found: ${flags.resume}`);
    process.exit(1);
  }

  console.log(`Resuming run: ${flags.resume}`);

  const config = loadConfig("earth-default");
  if (!config) {
    console.error("Failed to load default config for resume");
    process.exit(1);
  }

  const { orchestrator, agents, world } = bootstrapSimulation(config, {
    eventBus,
    clock,
    gateway,
    speciesRegistry,
    database: db,
  });

  RunContext.set({
    runId: flags.resume,
    branchId: "main",
    config,
    world,
    orchestrator,
    clock,
    eventBus,
    agents,
    status: "running",
  });

  clock.start(
    config.time || { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 100 },
  );
  RunManager.updateRunStatus(flags.resume, "running");

  console.log(`Simulation running. Tick: ${clock.getTick()}`);
} else if (flags.config || flags.configName) {
  const configSource = flags.config || flags.configName || "earth-default";
  console.log(`Loading config: ${configSource}`);

  const config = loadConfig(configSource);
  if (!config) {
    console.error(`Failed to load config: ${configSource}`);
    process.exit(1);
  }

  const configHash = config.meta.seed.toString(36).slice(0, 12);
  const runId = `run-${config.meta.seed}-${configHash}`;

  const existing = RunManager.getRun(runId);
  if (existing) {
    console.log(`Run already exists: ${runId}`);
  } else {
    RunManager.createRun(runId, config.meta.name, 0, config);
    console.log(`Created run: ${runId}`);
  }

  const { orchestrator, agents, world } = bootstrapSimulation(config, {
    eventBus,
    clock,
    gateway,
    speciesRegistry,
    database: db,
  });

  RunContext.set({
    runId,
    branchId: "main",
    config,
    world,
    orchestrator,
    clock,
    eventBus,
    agents,
    status: "running",
  });

  if (flags.watch) {
    watcher = new Watcher(eventBus);
  }

  clock.start(
    config.time || { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 100 },
  );
  RunManager.updateRunStatus(runId, "running");

  if (flags.watch) {
    watcher = new Watcher(eventBus);
    console.log("Watcher mode enabled.");
  }

  console.log(`Simulation running with ${agents.length} agents.`);
} else {
  console.log("Server started in neutral state.");
  console.log("Use the Management API to create and start a run:");
  console.log(
    `  curl -X POST http://localhost:${flags.port}/runs -H "Content-Type: application/json" -d '{"config": "earth-default"}'`,
  );
}
