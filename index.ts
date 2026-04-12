import { readFileSync } from "node:fs";
import { System2 } from "./server/agents/system2";
import { EventBus } from "./server/core/event-bus";
import { Orchestrator } from "./server/core/orchestrator";
import { SimClock } from "./server/core/sim-clock";
import { LLMGateway } from "./server/llm/gateway";
import { PhysicsEngine } from "./server/world/physics-engine";
import { VoxelGrid } from "./server/world/voxel-grid";
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

const world = new VoxelGrid(config.terrain.width, config.terrain.depth, config.terrain.height);
const eventBus = new EventBus();
const clock = new SimClock(async (_tick) => {
  await orchestrator.tick();
});
const physics = new PhysicsEngine(config.physics);
const gateway = new LLMGateway();
const system2 = new System2(gateway);

const ws = new WebSocketServer(eventBus);
ws.start(3001);

const orchestrator = new Orchestrator(config, world, clock, eventBus, physics, system2);

clock.start(
  config.time || { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 100 },
);

console.log("Cognis simulation running...");
