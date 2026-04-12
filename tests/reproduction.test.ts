import { beforeAll, expect, test } from "bun:test";
import { Reproduction } from "../server/agents/reproduction";
import { db } from "../server/persistence/database";
import type { AgentState, SpeciesConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const mockSpecies: SpeciesConfig = {
  muscleStatRanges: {
    strength: [0.1, 1.0],
    speed: [0.1, 1.0],
    endurance: [0.1, 1.0],
  },
} as unknown as SpeciesConfig;

test("Reproduction: crossover blends and mutates stats", () => {
  const pA = {
    muscleStats: { strength: 0.8, speed: 0.8, endurance: 0.8 },
  } as unknown as AgentState;
  const pB = {
    muscleStats: { strength: 0.4, speed: 0.4, endurance: 0.4 },
  } as unknown as AgentState;

  const childStats = Reproduction.crossover(pA, pB, mockSpecies);

  expect(childStats.strength).toBeGreaterThan(0.3);
  expect(childStats.strength).toBeLessThan(0.9);
});

test("Reproduction: handleDeath logs semantic store", () => {
  const agent = {
    id: "a1",
    semanticStore: [{ concept: "fire_is_hot", value: "true" }],
  } as unknown as AgentState;

  Reproduction.handleDeath(agent, "main", 100);

  const logs = db.getAuditLogs("main");
  expect(logs.some((l) => l.system === "DeathAudit" && l.field === "fire_is_hot")).toBe(true);
});
