import { beforeAll, expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { Consolidation } from "../server/memory/consolidation";
import { SemanticStore } from "../server/memory/semantic-store";
import { db } from "../server/persistence/database";
import { DEATH_CONCEPT_OBSERVATIONS_REQUIRED } from "../shared/constants";
import type { AgentState } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM semantic_beliefs");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

test("SemanticStore: tracks death observations via sum", () => {
  const agentId = "agent_death_test";
  const branchId = "main";

  for (let i = 0; i < 3; i++) {
    SemanticStore.trackDeathObservation(agentId, branchId, "observed_agent_stillness");
  }

  const count = SemanticStore.getDeathObservationCount(
    agentId,
    branchId,
    "observed_agent_stillness",
  );
  expect(count).toBe(3);
});

test("Consolidation: unlocks death concept when threshold met", () => {
  const agentId = "agent_consol_test";
  const branchId = "main";
  const bus = new EventBus();

  const agent = {
    id: agentId,
    lexicon: [],
    relationships: [],
    semanticStore: [],
    feelingResidues: [],
  } as unknown as AgentState;

  // Add observations to meet threshold
  for (let i = 0; i < DEATH_CONCEPT_OBSERVATIONS_REQUIRED; i++) {
    SemanticStore.trackDeathObservation(agentId, branchId, "observed_agent_stillness");
    SemanticStore.trackDeathObservation(agentId, branchId, "observed_absent_emotional_field");
    SemanticStore.trackDeathObservation(agentId, branchId, "observed_cold_body");
  }

  let deathDiscovered = false;
  bus.onAny((e) => {
    if (e.type === "death_concept_discovered") deathDiscovered = true;
  });

  Consolidation.consolidate(agent, branchId, bus);
  expect(deathDiscovered).toBe(true);
});
