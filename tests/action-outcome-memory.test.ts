import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import {
  ActionOutcomeMemory,
  type ActionOutcomeRecord,
} from "../server/agents/action-outcome-memory";
import { db } from "../server/persistence/database";

function record(tick: number, cueSignature: string): ActionOutcomeRecord {
  return {
    agentId: "agent-1",
    tick,
    cueSignature,
    targetRef: "foreground_0",
    success: true,
    motorPlan: {
      source: "procedural",
      urgency: 0.5,
      createdAtTick: tick,
      primitives: [
        {
          type: ActuationType.LICK,
          target: { type: "perceptual_ref", ref: "foreground_0" },
          intensity: 0.5,
          durationTicks: 1,
        },
      ],
    },
    outcome: {
      deltaVisceralContraction: -0.2,
      deltaOralDryness: -0.3,
      deltaPain: 0,
      deltaToxinLoad: 0,
      deltaHealth: 0.01,
      deltaArousal: -0.1,
      reliefScore: 0.4,
      harmScore: 0.05,
    },
  };
}

test("ActionOutcomeMemory: records and finds similar cues with limit", () => {
  const memory = new ActionOutcomeMemory();
  memory.record(record(1, "cue-a"));
  memory.record(record(2, "cue-b"));
  memory.record(record(3, "cue-a"));
  memory.record(record(4, "cue-a"));

  const found = memory.findSimilar("cue-a", 2);
  expect(found.length).toBe(2);
  expect(found[0]?.tick).toBe(3);
  expect(found[1]?.tick).toBe(4);
});

test("ActionOutcomeMemory: persists records into procedural_outcomes when context is configured", () => {
  const runId = `test-run-${Date.now()}`;
  const branchId = "main";
  const agentId = "agent-persist-1";
  const entry = { ...record(7, "cue-persist"), agentId };

  const memory = new ActionOutcomeMemory({ runId, branchId });
  memory.record(entry);

  const row = db.db
    .query<{ count: number; merkle_hash: string }, [string, string, string, string]>(
      `SELECT COUNT(*) AS count, MAX(merkle_hash) AS merkle_hash
       FROM procedural_outcomes
       WHERE run_id = ? AND branch_id = ? AND agent_id = ? AND cue_signature = ?`,
    )
    .get(runId, branchId, agentId, "cue-persist");

  expect(row?.count ?? 0).toBe(1);
  expect((row?.merkle_hash?.length ?? 0) > 0).toBe(true);
});

test("ActionOutcomeMemory: hydrates persisted outcomes for replay without duplicating rows", () => {
  const runId = `test-run-hydrate-${Date.now()}`;
  const branchId = "main";
  const agentId = "agent-hydrate-1";
  const entry = { ...record(9, "cue-hydrate"), agentId };

  const writer = new ActionOutcomeMemory({ runId, branchId });
  writer.record(entry);

  const reader = new ActionOutcomeMemory({ runId, branchId });
  const hydrated = reader.hydrate(agentId, 10);

  expect(hydrated.length).toBe(1);
  expect(hydrated[0]?.cueSignature).toBe("cue-hydrate");
  expect(reader.findSimilar("cue-hydrate", 5).length).toBe(1);

  const persistedCount = db.db
    .query<{ count: number }, [string, string, string]>(
      `SELECT COUNT(*) AS count
       FROM procedural_outcomes
       WHERE run_id = ? AND branch_id = ? AND agent_id = ?`,
    )
    .get(runId, branchId, agentId);

  expect(persistedCount?.count ?? 0).toBe(1);
});

test("ActionOutcomeMemory: hydrate is idempotent across repeated calls", () => {
  const runId = `test-run-hydrate-repeat-${Date.now()}`;
  const branchId = "main";
  const agentId = "agent-hydrate-repeat-1";
  const entry = { ...record(10, "cue-hydrate-repeat"), agentId };

  const writer = new ActionOutcomeMemory({ runId, branchId });
  writer.record(entry);

  const reader = new ActionOutcomeMemory({ runId, branchId });
  reader.hydrate(agentId, 10);
  reader.hydrate(agentId, 10);

  const similar = reader.findSimilar("cue-hydrate-repeat", 10);
  expect(similar.length).toBe(1);
});
