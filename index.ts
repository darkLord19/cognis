import { readFileSync } from "node:fs";
import { bootstrapSimulation } from "./server/core/bootstrap";
import { EventBus } from "./server/core/event-bus";
import { SimClock } from "./server/core/sim-clock";
import { LLMGateway } from "./server/llm/gateway";
import { db } from "./server/persistence/database";
import { SpeciesRegistry } from "./server/species/registry";
import { WebSocketServer } from "./server/ws/server";
import type { WorldConfig } from "./shared/types";

const configPath = process.env.WORLD_CONFIG || "./data/world-configs/earth-default.json";
let config: WorldConfig;
try {
  config = JSON.parse(readFileSync(configPath, "utf8")) as WorldConfig;
} catch (e) {
  console.error("Failed to load world config:", e);
  process.exit(1);
}

const eventBus = new EventBus();
const clock = new SimClock(async (_tick) => {
  await orchestrator.tick();
});
const gateway = new LLMGateway();

// Load species registry
const speciesRegistry = new SpeciesRegistry();
try {
  speciesRegistry.loadAll();
} catch {
  console.warn("No species data found — using defaults.");
}
const ws = new WebSocketServer(eventBus);
ws.start(3001);

const {
  orchestrator,
  agents,
  runId,
  config: runtimeConfig,
} = bootstrapSimulation(config, {
  eventBus,
  clock,
  gateway,
  speciesRegistry,
  database: db,
});

clock.start(
  runtimeConfig.time || { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 100 },
);

console.log(`Cognis simulation running with ${agents.length} agents in ${runId}.`);
