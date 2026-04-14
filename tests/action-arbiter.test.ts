import { expect, test } from "bun:test";
import { ActionArbiter } from "../server/agents/action-arbiter";
import { ActuationType, type MotorPlan } from "../server/agents/action-grammar";

function plan(source: MotorPlan["source"], urgency: number): MotorPlan {
  return {
    source,
    urgency,
    createdAtTick: 1,
    primitives: [
      {
        type: ActuationType.REST_POSTURE,
        target: { type: "self" },
        intensity: 0.4,
        durationTicks: 1,
      },
    ],
  };
}

test("ActionArbiter: reflex plan has highest priority", () => {
  const arbiter = new ActionArbiter();
  const selected = arbiter.choose({
    reflexPlan: plan("system0", 0.9),
    proceduralPlan: plan("procedural", 0.8),
    system2Plan: plan("system2", 0.7),
    fallbackPlan: plan("fallback", 0.2),
  });

  expect(selected.source).toBe("system0");
});

test("ActionArbiter: high urgency procedural can preempt system2", () => {
  const arbiter = new ActionArbiter();
  const selected = arbiter.choose({
    proceduralPlan: plan("procedural", 0.9),
    system2Plan: plan("system2", 0.7),
    fallbackPlan: plan("fallback", 0.2),
  });

  expect(selected.source).toBe("procedural");
});

test("ActionArbiter: fallback is used when no other plan exists", () => {
  const arbiter = new ActionArbiter();
  const selected = arbiter.choose({
    fallbackPlan: plan("fallback", 0.2),
  });

  expect(selected.source).toBe("fallback");
});
