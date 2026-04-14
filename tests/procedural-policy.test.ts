import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import type { LearnedAffordance } from "../server/agents/affordance-learner";
import { ProceduralPolicy } from "../server/agents/procedural-policy";
import type { QualiaFrame } from "../server/agents/qualia-types";
import type { AgentState } from "../shared/types";

function createAgent(): AgentState {
  return {
    id: "agent-1",
    speciesId: "proto_human",
    name: "Agent 1",
    generation: 1,
    body: {
      energy: 0.7,
      hydration: 0.3,
      toxinLoad: 0.1,
      oxygenation: 0.9,
      fatigue: 0.2,
      coreTemperature: 15,
      inflammation: 0.1,
      painLoad: 0,
      health: 0.9,
      bodyMap: {
        head: { pain: 0, temperature: 15, damage: 0 },
        torso: { pain: 0, temperature: 15, damage: 0 },
        leftArm: { pain: 0, temperature: 15, damage: 0 },
        rightArm: { pain: 0, temperature: 15, damage: 0 },
        leftLeg: { pain: 0, temperature: 15, damage: 0 },
        rightLeg: { pain: 0, temperature: 15, damage: 0 },
      },
      arousal: 0.2,
      valence: 0.1,
      cycleHormone: 0.3,
      circadianPhase: 0.5,
      integrityDrive: 0.2,
      recentConsumptions: [],
    },
    position: { x: 0, y: 0, z: 0 },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: { strength: 0.5, speed: 0.5, endurance: 0.5 },
    pendingSystem2: false,
    innerMonologue: "",
    selfNarrative: "",
    episodicStore: [],
    semanticStore: [],
    feelingResidues: [],
    lexicon: [],
    relationships: [],
    mentalModels: {},
    willScore: 0,
    age: 0,
    traumaFlags: [],
    conflictFlags: [],
    parentIds: [],
    inheritedMemoryFragments: [],
  };
}

const qualia: QualiaFrame = {
  agentId: "agent-1",
  tick: 10,
  body: [],
  world: [],
  social: [],
  urges: [],
  memories: [],
  narratableText: "a rough dryness and hollow pull gather in your body",
};

test("ProceduralPolicy: exploits strong learned affordance", () => {
  const policy = new ProceduralPolicy();
  const learned: LearnedAffordance[] = [
    {
      agentId: "agent-1",
      cueSignature: "dry_core_with_presence",
      targetSignature: "foreground_0",
      motorPrimitiveType: ActuationType.LICK,
      expectedOutcome: {
        deltaVisceralContraction: -0.2,
        deltaOralDryness: -0.3,
        deltaPain: 0,
        deltaToxinLoad: 0,
        deltaHealth: 0.05,
        deltaArousal: -0.1,
        reliefScore: 0.6,
        harmScore: 0.05,
      },
      confidence: 0.82,
      attempts: 6,
      successes: 5,
      failures: 1,
      lastUpdatedTick: 9,
    },
  ];

  const plan = policy.propose({
    agent: createAgent(),
    qualiaFrame: qualia,
    sensorBundle: { readings: new Float32Array(64) },
    learnedAffordances: learned,
    tick: 11,
    rng: { next: () => 0.2 },
  });

  expect(plan.source).toBe("procedural");
  expect(plan.primitives[0]?.type).toBe(ActuationType.LICK);
});

test("ProceduralPolicy: explores when no strong affordance exists", () => {
  const policy = new ProceduralPolicy();
  const plan = policy.propose({
    agent: createAgent(),
    qualiaFrame: qualia,
    sensorBundle: { readings: new Float32Array(64) },
    learnedAffordances: [],
    tick: 15,
    rng: { next: () => 0 },
  });

  expect(plan.source).toBe("procedural");
  expect(plan.primitives.length).toBe(1);
});
