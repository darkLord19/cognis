import { expect, test } from "bun:test";
import { ActuationType } from "../../server/agents/action-grammar";
import type { ActionOutcomeRecord } from "../../server/agents/action-outcome-memory";
import { ActionOutcomeMemory } from "../../server/agents/action-outcome-memory";
import { AffordanceLearner } from "../../server/agents/affordance-learner";

type TargetRef = "edible_ref" | "toxic_ref";

type ToxicMetrics = {
  initialToxicRate: number;
  finalToxicRate: number;
  toxinExposureCount: number;
  bitterContactCount: number;
};

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function record(tick: number, cue: string, target: TargetRef): ActionOutcomeRecord {
  const toxic = target === "toxic_ref";
  return {
    agentId: "a1",
    tick,
    cueSignature: cue,
    targetRef: target,
    motorPlan: {
      source: "procedural",
      urgency: 0.6,
      createdAtTick: tick,
      primitives: [
        {
          type: ActuationType.LICK,
          target: { type: "perceptual_ref", ref: target },
          intensity: 0.8,
          durationTicks: 1,
        },
      ],
    },
    outcome: {
      deltaVisceralContraction: toxic ? 0 : -0.08,
      deltaOralDryness: toxic ? 0.02 : -0.06,
      deltaPain: toxic ? 0.3 : 0.02,
      deltaToxinLoad: toxic ? 0.35 : 0,
      deltaHealth: toxic ? -0.12 : 0.02,
      deltaArousal: toxic ? 0.25 : 0.05,
      reliefScore: toxic ? 0.03 : 0.45,
      harmScore: toxic ? 0.55 : 0.05,
    },
    success: true,
  };
}

function simulate(seed: number): ToxicMetrics {
  const rng = makeRng(seed);
  const memory = new ActionOutcomeMemory();
  const learner = new AffordanceLearner(memory);

  let toxinExposureCount = 0;
  let bitterContactCount = 0;
  let toxicEarly = 0;
  let toxicLate = 0;
  const steps = 240;

  for (let tick = 0; tick < steps; tick++) {
    const cue = "bitter_frontier";
    const candidates = learner.getCandidates(cue);
    const best = candidates[0];

    const shouldExploit = Boolean(
      best && best.confidence > 0.45 && (tick > steps / 3 ? rng() > 0.05 : rng() > 0.25),
    );
    const target = shouldExploit
      ? ((best?.targetSignature as TargetRef) ?? "edible_ref")
      : ((rng() < 0.5 ? "toxic_ref" : "edible_ref") as TargetRef);

    bitterContactCount++;
    if (target === "toxic_ref") {
      toxinExposureCount++;
      if (tick < steps / 2) toxicEarly++;
      else toxicLate++;
    }

    learner.updateFromOutcome(record(tick, cue, target));
  }

  const halfWindow = steps / 2;
  return {
    initialToxicRate: toxicEarly / halfWindow,
    finalToxicRate: toxicLate / halfWindow,
    toxinExposureCount,
    bitterContactCount,
  };
}

test("toxic avoidance: repeated toxic ingestion decreases after learned sickness", () => {
  const metrics = simulate(19);
  expect(metrics.toxinExposureCount).toBeGreaterThan(0);
  expect(metrics.bitterContactCount).toBeGreaterThan(0);
  expect(metrics.finalToxicRate).toBeLessThan(metrics.initialToxicRate * 0.7);
});
