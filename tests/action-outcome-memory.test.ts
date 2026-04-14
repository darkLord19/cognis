import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import {
  ActionOutcomeMemory,
  type ActionOutcomeRecord,
} from "../server/agents/action-outcome-memory";

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
