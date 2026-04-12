import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { RunService } from "../server/core/run-service";
import { RunStateStore } from "../server/core/run-state-store";
import { RunSupervisor } from "../server/core/run-supervisor";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";

let supervisor: RunSupervisor;
let service: RunService;

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM run_state_events");
  db.db.exec("DELETE FROM config_mutations");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("DELETE FROM runs");
  db.db.exec("PRAGMA foreign_keys = ON;");

  supervisor = new RunSupervisor();
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();
  service = new RunService({
    runSupervisor: supervisor,
    gateway: new LLMGateway(new MockLLMGateway()),
    speciesRegistry,
    database: db,
  });
});

afterEach(() => {
  supervisor.shutdownAll();
});

test("RunService creates a persisted run and records append-only created state", () => {
  const created = service.createRun({ config: "earth-default", name: "Test Run", seed: 42 });
  const latest = RunStateStore.getLatest(created.id);

  expect(created.status).toBe("created");
  expect(latest?.status).toBe("created");
  expect(latest?.tick).toBe(0);
});

test("RunService starts, pauses, resumes, and stops a shared runtime", () => {
  const created = service.createRun({ config: "earth-default", seed: 4242 });

  const started = service.startRun(created.id);
  expect(started.status).toBe("running");
  expect(supervisor.getRuntime(created.id)?.status).toBe("running");

  const paused = service.pauseRun(created.id);
  expect(paused.status).toBe("paused");
  expect(RunStateStore.getLatest(created.id)?.status).toBe("paused");

  const resumed = service.startRun(created.id);
  expect(resumed.status).toBe("running");
  expect(RunStateStore.getLatest(created.id)?.status).toBe("running");

  const stopped = service.stopRun(created.id);
  expect(stopped.status).toBe("stopped");
  expect(supervisor.getRuntime(created.id)).toBeUndefined();
  expect(RunStateStore.getLatest(created.id)?.status).toBe("stopped");
});

test("RunService rejects configs with deprecated schema fields", () => {
  const invalid = JSON.parse(
    readFileSync("./data/world-configs/earth-default.json", "utf8"),
  ) as Record<string, unknown>;
  invalid.agents = { initialCount: 10, startingMode: "none" };
  invalid.language = { stagesEnabled: [1, 2, 3], driftRate: 0.01 };
  invalid.elements = { fireSpreadRate: 0.1 };
  invalid.species = [];

  expect(() =>
    service.createRun({
      inlineConfig: invalid as never,
    }),
  ).toThrow(/agents\.count|stagesEnabled|fireSpreadRate|species/i);
});
