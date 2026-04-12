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
