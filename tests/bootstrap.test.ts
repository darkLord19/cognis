import { expect, test } from "bun:test";
import { bootstrapSimulation } from "../server/core/bootstrap";
import { EventBus } from "../server/core/event-bus";
import { RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";
import type { LLMGateway } from "../server/llm/gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";
import type { WorldConfig } from "../shared/types";

test("bootstrapSimulation: initializes run, branch, terrain, and agents from config", () => {
  const config = {
    meta: { name: "test", seed: 123 },
    agents: { initialCount: 5 },
    terrain: { width: 10, height: 10, depth: 10 },
    physics: { gravity: 0.1 },
    perception: { residueDecayRate: 0.1 },
    memory: { decayRate: 0.1 },
    species: [
      {
        id: "human",
        name: "Human",
        baseStats: { maxHealth: 100 },
        muscleStatRanges: { strength: [1, 2], speed: [1, 2], endurance: [1, 2] },
      },
    ],
  } as unknown as WorldConfig;
  const deps = {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry: new SpeciesRegistry(),
    database: db,
    runSupervisor: new RunSupervisor(),
  };

  const boot = bootstrapSimulation(config, deps);
  expect(boot.runId).toBeDefined();
  expect(boot.agents.length).toBe(5);
  expect(boot.orchestrator).toBeDefined();
});

test("bootstrapSimulation: initializes non-zero baseline body state", () => {
  const config = {
    meta: { name: "test", seed: 456 },
    agents: { initialCount: 1 },
    terrain: { width: 10, height: 10, depth: 10 },
    physics: { gravity: 0.1, temperatureBaseline: 18 },
    perception: { residueDecayRate: 0.1 },
    memory: { decayRate: 0.1 },
    species: [
      {
        id: "human",
        name: "Human",
        baseStats: { maxHealth: 100 },
        muscleStatRanges: { strength: [1, 2], speed: [1, 2], endurance: [1, 2] },
      },
    ],
  } as unknown as WorldConfig;
  const deps = {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry: new SpeciesRegistry(),
    database: db,
    runSupervisor: new RunSupervisor(),
  };

  const [agent] = bootstrapSimulation(config, deps).agents;
  expect(agent).toBeDefined();
  expect(agent?.body.energy).toBeLessThan(1);
  expect(agent?.body.hydration).toBeLessThan(1);
  expect(agent?.body.fatigue).toBeGreaterThan(0);
  expect(agent?.body.health).toBe(1);
  expect(agent?.body.coreTemperature).toBe(18);
  expect(agent?.body.bodyMap.head.temperature).toBe(18);
});

test("bootstrapSimulation: restarting against existing state does not fail on duplicate IDs", () => {
  const config = {
    meta: { name: "test", seed: 123 },
    agents: { initialCount: 5 },
    terrain: { width: 10, height: 10, depth: 10 },
    physics: { gravity: 0.1 },
    perception: { residueDecayRate: 0.1 },
    memory: { decayRate: 0.1 },
    species: [
      {
        id: "human",
        name: "Human",
        baseStats: { maxHealth: 100 },
        muscleStatRanges: { strength: [1, 2], speed: [1, 2], endurance: [1, 2] },
      },
    ],
  } as unknown as WorldConfig;
  const deps = {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry: new SpeciesRegistry(),
    database: db,
    runSupervisor: new RunSupervisor(),
  };

  bootstrapSimulation(config, deps);
  expect(() => bootstrapSimulation(config, deps)).not.toThrow();
});

test("bootstrapSimulation: respects startingArea and keeps spawn positions in bounds", () => {
  const config = {
    meta: { name: "spawn-area-test", seed: 789 },
    agents: { count: 6, speciesId: "human", startingArea: { centerX: 5, centerZ: 6, radius: 2 } },
    terrain: { width: 12, height: 10, depth: 12, seed: 789, waterLevel: 0.2, biomes: ["plains"] },
    physics: { gravity: 0.1, temperatureBaseline: 15 },
    perception: { residueDecayRate: 0.1 },
    memory: { decayRate: 0.1 },
    species: [
      {
        id: "human",
        name: "Human",
        baseStats: { maxHealth: 100 },
        muscleStatRanges: { strength: [1, 2], speed: [1, 2], endurance: [1, 2] },
      },
    ],
  } as unknown as WorldConfig;
  const deps = {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry: new SpeciesRegistry(),
    database: db,
    runSupervisor: new RunSupervisor(),
  };

  const boot = bootstrapSimulation(config, deps);
  expect(boot.agents.length).toBe(6);
  const startingArea = config.agents.startingArea;
  if (!startingArea) {
    throw new Error("startingArea missing");
  }

  for (const agent of boot.agents) {
    expect(agent.position.x).toBeGreaterThanOrEqual(0);
    expect(agent.position.x).toBeLessThan(config.terrain.width);
    expect(agent.position.z).toBeGreaterThanOrEqual(0);
    expect(agent.position.z).toBeLessThan(config.terrain.depth);

    const dx = agent.position.x - startingArea.centerX;
    const dz = agent.position.z - startingArea.centerZ;
    const radialDistance = Math.sqrt(dx * dx + dz * dz);
    expect(radialDistance).toBeLessThanOrEqual(startingArea.radius + 1);
  }
});
