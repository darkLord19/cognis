import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GlassModeManager } from "./server/agents/glass-mode";
import { setApiDependencies, startManagementApi } from "./server/api/management-api";
import { Watcher } from "./server/api/watcher";
import { RunManager } from "./server/core/run-manager";
import { RunService } from "./server/core/run-service";
import { RunSupervisor } from "./server/core/run-supervisor";
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
const runSupervisor = new RunSupervisor();

async function shutdown() {
  console.log("\nShutting down...");
  runSupervisor.shutdownAll();

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

const gateway = new LLMGateway();

const speciesRegistry = new SpeciesRegistry();
try {
  speciesRegistry.loadAll();
} catch {
  console.warn("No species data found — using defaults.");
}

const runService = new RunService({
  runSupervisor,
  gateway,
  speciesRegistry,
  database: db,
});
const glassModeManager = new GlassModeManager();

const ws = new WebSocketServer(runSupervisor);
ws.start(flags.wsPort);

setApiDependencies({ runService, runSupervisor, glassModeManager });
startManagementApi(flags.port);

if (flags.resume) {
  const run = RunManager.getRun(flags.resume);
  if (!run) {
    console.error(`Run not found: ${flags.resume}`);
    process.exit(1);
  }

  console.log(`Resuming run: ${flags.resume}`);
  const started = runService.startRun(flags.resume);
  const runtime = runService.getRuntime(flags.resume);
  if (flags.watch && runtime) {
    watcher = new Watcher(runtime.eventBus, {}, () => runtime.agents.length);
    console.log("Watcher mode enabled.");
  }
  console.log(`Simulation running. Tick: ${started.currentTick}`);
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
    runService.createRun({
      inlineConfig: config,
      name: config.meta.name,
      seed: config.meta.seed,
    });
    console.log(`Created run: ${runId}`);
  }

  runService.startRun(runId);
  const runtime = runService.getRuntime(runId);

  if (flags.watch && runtime) {
    watcher = new Watcher(runtime.eventBus, {}, () => runtime.agents.length);
    console.log("Watcher mode enabled.");
  }

  console.log(`Simulation running with ${runtime?.agents.length ?? 0} agents.`);
} else {
  console.log("Server started in neutral state.");
  console.log("Use the Management API to create and start a run:");
  console.log(
    `  curl -X POST http://localhost:${flags.port}/runs -H "Content-Type: application/json" -d '{"config": "earth-default"}'`,
  );
}
