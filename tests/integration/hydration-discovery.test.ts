import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ActuationType } from "../../server/agents/action-grammar";
import {
  ActionOutcomeMemory,
  type ActionOutcomeRecord,
} from "../../server/agents/action-outcome-memory";
import { AffordanceLearner } from "../../server/agents/affordance-learner";

type DiscoveryMetrics = {
  ticksToFirstMouthContactWithHydratingMaterial?: number;
  ticksToFirstHydrationImprovement?: number;
  repeatHydratingActionRate: number;
  toxicRepeatRateAfterSickness: number;
  survivalTicks: number;
};

type SimulationMode = "random" | "learner";

type WorldTarget = "water_ref" | "neutral_ref" | "toxic_ref";

const TARGETS: WorldTarget[] = ["water_ref", "neutral_ref", "toxic_ref"];

type HydrationFixture = {
  id: string;
  description: string;
  materials: string[];
  spawn: {
    hostCount: number;
    nearWater: boolean;
  };
};

function loadHydrationFixture(): HydrationFixture {
  return JSON.parse(
    readFileSync("./tests/fixtures/worlds/hydration-basic.json", "utf8"),
  ) as HydrationFixture;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function makeRng(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 0xffffffff;
  };
}

function chooseRandom(rng: () => number): WorldTarget {
  const index = Math.floor(rng() * TARGETS.length);
  return TARGETS[Math.max(0, Math.min(TARGETS.length - 1, index))] as WorldTarget;
}

function buildRecord(
  tick: number,
  cue: string,
  target: WorldTarget,
  hydrationDelta: number,
  toxinDelta: number,
  harmScore: number,
): ActionOutcomeRecord {
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
      deltaVisceralContraction: 0,
      deltaOralDryness: -hydrationDelta,
      deltaPain: harmScore,
      deltaToxinLoad: toxinDelta,
      deltaHealth: -harmScore,
      deltaArousal: harmScore,
      reliefScore: Math.max(0, hydrationDelta),
      harmScore,
    },
    success: true,
  };
}

function simulate(mode: SimulationMode, seed: number): DiscoveryMetrics {
  const rng = makeRng(seed);
  const memory = new ActionOutcomeMemory();
  const learner = new AffordanceLearner(memory);

  let hydration = 0.55;
  let health = 1.0;
  let toxinLoad = 0;
  let survivalTicks = 0;

  let firstHydratingMouthTick: number | undefined;
  let firstHydrationGainTick: number | undefined;
  let firstSicknessTick: number | undefined;
  let hydratingActionsAfterFirstGain = 0;
  let actionsAfterFirstGain = 0;
  let toxicActionsAfterSickness = 0;
  let actionsAfterSickness = 0;

  for (let tick = 0; tick < 220; tick++) {
    hydration = Math.max(0, hydration - 0.018);
    toxinLoad = Math.max(0, toxinLoad - 0.01);
    health = Math.max(0, health - Math.max(0, 0.45 - hydration) * 0.02 - toxinLoad * 0.015);
    if (health <= 0 || hydration <= 0) break;

    const cue = hydration < 0.4 ? "oral_dryness_high" : "neutral";
    let target: WorldTarget;
    if (mode === "learner") {
      const candidates = learner
        .getCandidates(cue)
        .filter((entry) => TARGETS.includes(entry.targetSignature as WorldTarget));
      const best = candidates[0];
      const shouldExploit = Boolean(best && best.confidence > 0.45 && rng() > 0.2);
      target = shouldExploit ? (best?.targetSignature as WorldTarget) : chooseRandom(rng);
    } else {
      target = chooseRandom(rng);
    }

    if (target === "water_ref" && firstHydratingMouthTick === undefined) {
      firstHydratingMouthTick = tick;
    }

    let hydrationDelta = 0;
    let toxinDelta = 0;
    let harmScore = 0;

    if (target === "water_ref") {
      hydrationDelta = 0.22;
    } else if (target === "neutral_ref") {
      hydrationDelta = 0.01;
    } else {
      hydrationDelta = 0.02;
      toxinDelta = 0.28;
      harmScore = 0.35;
    }

    hydration = clamp01(hydration + hydrationDelta);
    toxinLoad = clamp01(toxinLoad + toxinDelta);
    health = clamp01(health - harmScore * 0.06);

    if (hydrationDelta > 0.05 && firstHydrationGainTick === undefined) {
      firstHydrationGainTick = tick;
    }
    if (toxinDelta > 0.2 && firstSicknessTick === undefined) {
      firstSicknessTick = tick;
    }

    if (firstHydrationGainTick !== undefined) {
      actionsAfterFirstGain++;
      if (target === "water_ref") hydratingActionsAfterFirstGain++;
    }
    if (firstSicknessTick !== undefined) {
      actionsAfterSickness++;
      if (target === "toxic_ref") toxicActionsAfterSickness++;
    }

    if (mode === "learner") {
      learner.updateFromOutcome(
        buildRecord(tick, cue, target, hydrationDelta, toxinDelta, harmScore),
      );
    }

    survivalTicks = tick + 1;
  }

  const metrics: DiscoveryMetrics = {
    repeatHydratingActionRate:
      actionsAfterFirstGain === 0 ? 0 : hydratingActionsAfterFirstGain / actionsAfterFirstGain,
    toxicRepeatRateAfterSickness:
      actionsAfterSickness === 0 ? 1 : toxicActionsAfterSickness / actionsAfterSickness,
    survivalTicks,
  };
  if (firstHydratingMouthTick !== undefined) {
    metrics.ticksToFirstMouthContactWithHydratingMaterial = firstHydratingMouthTick;
  }
  if (firstHydrationGainTick !== undefined) {
    metrics.ticksToFirstHydrationImprovement = firstHydrationGainTick;
  }
  return metrics;
}

test("hydration discovery fixture declares required material and spawn constraints", () => {
  const fixture = loadHydrationFixture();
  const materialSet = new Set(fixture.materials);

  expect(fixture.id).toBe("hydration-basic");
  expect(fixture.spawn.hostCount).toBe(1);
  expect(fixture.spawn.nearWater).toBe(true);
  expect(materialSet.has("fresh_water")).toBe(true);
  expect(materialSet.has("edible_soft_plant")).toBe(true);
  expect(materialSet.has("toxic_bitter_plant")).toBe(true);
});

test("hydration discovery: procedural learner improves over random baseline", () => {
  const random = simulate("random", 11);
  const learner = simulate("learner", 11);

  expect(learner.ticksToFirstHydrationImprovement).toBeDefined();
  expect(learner.survivalTicks).toBeGreaterThan(random.survivalTicks * 1.25);
  expect(learner.repeatHydratingActionRate).toBeGreaterThan(random.repeatHydratingActionRate);
  expect(learner.toxicRepeatRateAfterSickness).toBeLessThan(random.toxicRepeatRateAfterSickness);
});
