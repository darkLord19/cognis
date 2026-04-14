import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { bootstrapSimulation } from "../server/core/bootstrap";
import { EventBus } from "../server/core/event-bus";
import { RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";
import type { LLMGateway } from "../server/llm/gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";
import type { WorldConfig } from "../shared/types";

function loadHydrationConfig(): WorldConfig {
  return JSON.parse(
    readFileSync("./data/world-configs/v5-hydration-sandbox.json", "utf8"),
  ) as WorldConfig;
}

test("v5 hydration sandbox config has required resource and population setup", () => {
  const config = loadHydrationConfig();
  const resourceTypes = new Set(config.resources.resources.map((entry) => entry.type));
  const speciesRef = (config.species[0] as { $ref?: string } | undefined)?.$ref;

  expect(config.agents.count).toBe(1);
  expect(speciesRef).toBe("data/species/proto-human-forager.json");
  expect(resourceTypes.has("water")).toBe(true);
  expect(resourceTypes.has("food")).toBe(true);
  expect(resourceTypes.has("biomass")).toBe(true);
});

test("v5 hydration sandbox spawns one proto host near water without spawning in water", () => {
  const config = loadHydrationConfig();
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();

  const boot = bootstrapSimulation(config, {
    runId: `test-v5-hydration-${randomUUID()}`,
    branchId: "main",
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry,
    database: db,
    runSupervisor: new RunSupervisor(),
  });

  expect(boot.agents.length).toBe(1);
  const agent = boot.agents[0];
  expect(agent?.speciesId).toBe("proto-human-forager");

  const y = Math.floor(agent?.position.y ?? 0);
  const x = Math.floor(agent?.position.x ?? 0);
  const z = Math.floor(agent?.position.z ?? 0);
  const standingOn = boot.world.get(x, Math.max(0, y - 1), z);
  expect(standingOn?.material).not.toBe("water");

  let nearestWaterDistance = Number.POSITIVE_INFINITY;
  for (let wx = 0; wx < boot.world.width; wx++) {
    for (let wz = 0; wz < boot.world.depth; wz++) {
      const voxel = boot.world.get(wx, y, wz);
      if (voxel?.material !== "water") {
        continue;
      }
      const distance = Math.hypot(wx - (agent?.position.x ?? 0), wz - (agent?.position.z ?? 0));
      if (distance < nearestWaterDistance) {
        nearestWaterDistance = distance;
      }
    }
  }

  expect(Number.isFinite(nearestWaterDistance)).toBe(true);
  expect(nearestWaterDistance).toBeLessThanOrEqual(12);
});
