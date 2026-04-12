import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bootstrapSimulation } from "../server/core/bootstrap";
import { EventBus } from "../server/core/event-bus";
import { SimClock } from "../server/core/sim-clock";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM config_mutations");
  db.db.exec("DELETE FROM world_deltas");
  db.db.exec("DELETE FROM events");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM runs");
  db.db.exec("DELETE FROM branches");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

test("bootstrapSimulation: initializes run, branch, terrain, and agents from config", () => {
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();

  const config = JSON.parse(
    readFileSync("./data/world-configs/earth-default.json", "utf8"),
  ) as Parameters<typeof bootstrapSimulation>[0];
  config.terrain.width = 16;
  config.terrain.depth = 16;
  config.terrain.height = 16;
  config.agents.initialCount = 3;

  const boot = bootstrapSimulation(config, {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: new LLMGateway(new MockLLMGateway()),
    speciesRegistry,
    database: db,
  });

  const run = db.db.query("SELECT * FROM runs WHERE id = ?").get(boot.runId) as Record<
    string,
    unknown
  > | null;
  const branch = db.db.query("SELECT * FROM branches WHERE id = ?").get(boot.branchId) as Record<
    string,
    unknown
  > | null;

  expect(run?.status).toBe("created");
  expect(run?.world_config).toBeTruthy();
  expect(run?.world_config_hash).toBeTruthy();
  expect(branch?.name).toBe("main");
  expect(boot.agents.length).toBe(config.agents.initialCount);
  expect(boot.agents.some((agent) => agent.speciesId === "human")).toBe(true);
  expect(boot.world.get(0, 0, 0)).not.toBeNull();
  expect(boot.config).toEqual(config);
});

test("bootstrapSimulation: restarting against existing state does not fail on duplicate IDs", () => {
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();

  const config = JSON.parse(
    readFileSync("./data/world-configs/earth-default.json", "utf8"),
  ) as Parameters<typeof bootstrapSimulation>[0];
  config.terrain.width = 16;
  config.terrain.depth = 16;
  config.terrain.height = 16;
  config.agents.initialCount = 3;

  const deps = {
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: new LLMGateway(new MockLLMGateway()),
    speciesRegistry,
    database: db,
  };

  bootstrapSimulation(config, deps);

  expect(() => bootstrapSimulation(config, deps)).not.toThrow();
});
