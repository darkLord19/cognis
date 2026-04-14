import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import {
  ActionOutcomeMemory,
  type ActionOutcomeRecord,
} from "../server/agents/action-outcome-memory";
import { AffordanceLearner } from "../server/agents/affordance-learner";

function makeOutcome(reliefScore: number, harmScore: number, tick: number): ActionOutcomeRecord {
  return {
    agentId: "agent-1",
    tick,
    cueSignature: "dry_core_with_presence",
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
          intensity: 0.6,
          durationTicks: 1,
        },
      ],
    },
    outcome: {
      deltaVisceralContraction: -0.2,
      deltaOralDryness: -0.25,
      deltaPain: 0,
      deltaToxinLoad: 0,
      deltaHealth: 0.02,
      deltaArousal: -0.1,
      reliefScore,
      harmScore,
    },
  };
}

test("AffordanceLearner: confidence rises for repeated relieving outcomes", () => {
  const memory = new ActionOutcomeMemory();
  const learner = new AffordanceLearner(memory);

  const first = learner.updateFromOutcome(makeOutcome(0.6, 0.05, 1));
  const second = learner.updateFromOutcome(makeOutcome(0.7, 0.05, 2));

  expect(first).toBeDefined();
  expect(second).toBeDefined();
  expect((second?.confidence ?? 0) >= (first?.confidence ?? 0)).toBe(true);

  const candidates = learner.getCandidates("dry_core_with_presence");
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates[0]?.motorPrimitiveType).toBe(ActuationType.LICK);
});
