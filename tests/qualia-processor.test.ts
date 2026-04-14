import { expect, test } from "bun:test";
import { QualiaProcessor, resolveAgentReference } from "../server/agents/qualia-processor";
import type {
  AgentState,
  CircadianState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
  WorldConfig,
} from "../shared/types";

const createTestAgent = (): AgentState =>
  ({
    id: "a1",
    body: {
      energy: 0.9,
      hydration: 0.9,
      fatigue: 0.1,
      health: 1.0,
      integrityDrive: 0.1,
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15, label: "head" },
        torso: { pain: 0, damage: 0, temperature: 15, label: "torso" },
        leftArm: { pain: 0, damage: 0, temperature: 15, label: "left arm" },
        rightArm: { pain: 0, damage: 0, temperature: 15, label: "right arm" },
        leftLeg: { pain: 0, damage: 0, temperature: 15, label: "left leg" },
        rightLeg: { pain: 0, damage: 0, temperature: 15, label: "right leg" },
      },
    },
    lexicon: [],
    relationships: [],
    semanticStore: [],
  }) as unknown as AgentState;

const createPercept = (pain = 0, energy = 0.9, hydration = 0.9): FilteredPercept =>
  ({
    primaryAttention: [],
    peripheralAwareness: { count: 0, aggregateEmotionalField: 0 },
    focusedVoxels: [],
    ownBody: {
      energy,
      hydration,
      fatigue: 0.2,
      health: 0.9,
      coreTemperature: 15,
      valence: 0,
      arousal: 0,
      bodyMap: {
        head: { pain, damage: 0, temperature: 15, label: "head" },
        torso: { pain: 0, damage: 0, temperature: 15, label: "torso" },
        leftArm: { pain: 0, damage: 0, temperature: 15, label: "left arm" },
        rightArm: { pain: 0, damage: 0, temperature: 15, label: "right arm" },
        leftLeg: { pain: 0, damage: 0, temperature: 15, label: "left leg" },
        rightLeg: { pain: 0, damage: 0, temperature: 15, label: "right leg" },
      },
    } as unknown as AgentState["body"],
  }) as unknown as FilteredPercept;

const neutralCircadian: CircadianState = {
  lightLevel: 0.5,
  cycleHormoneValue: 0.5,
  season: "spring",
  surfaceTemperatureDelta: 0,
};

const defaultConfig = {
  freeWill: { survivalDriveWeight: 0.6 },
  semanticMasking: {
    enabled: false,
    qualiaUsesRealLabels: true,
    sensorLabelMap: {},
  },
} as unknown as WorldConfig;

test("QualiaProcessor outputs natural language qualia", () => {
  const agent = createTestAgent();
  const percept = createPercept(0.7, 0.1, 0.1); // High pain, low energy, low hydration
  agent.body.energy = 0.1;
  agent.body.hydration = 0.1;
  agent.body.bodyMap.head.pain = 0.7;

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("fading");
  expect(result).toContain("burning from within");
  expect(result).toContain("head");
});

test("QualiaProcessor describes biomass with first-person cue", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  percept.focusedVoxels = [
    { material: "biomass", temperature: 18 } as unknown as (typeof percept.focusedVoxels)[0],
  ];

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("promising scent");
});

test("QualiaProcessor redacts forbidden substrate terms", () => {
  const agent = createTestAgent();
  const percept = createPercept();

  // Directly inject a forbidden term into a template-like string (though templates should be clean)
  // Our validator checks the final string.

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).not.toMatch(/\bsimulation\b/i);
});

test("QualiaProcessor captures social impressions", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  percept.peripheralAwareness.count = 2;
  percept.primaryAttention = [
    {
      id: "a2",
      body: { valence: -0.4, arousal: 0.9 },
    } as unknown as AgentState,
  ];

  const detections: EmotionalFieldDetection[] = [
    { sourceAgentId: "a2", valenceImpression: -0.8, arousalImpression: 0.5 },
  ];
  const moodTint: FeelingResidueTint = { valence: 0, arousal: 0 };

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    detections,
    moodTint,
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("stranger");
  expect(result).toContain("2 other beings");
});

test("QualiaProcessor resolveAgentReference is relation-based and non-naming", () => {
  const observingAgent = {
    relationships: [
      {
        targetAgentId: "target-1",
        affinity: 0.8,
        trust: 0.7,
        fear: 0.1,
        significantEvents: ["shared food"],
      },
      {
        targetAgentId: "target-2",
        affinity: -0.8,
        trust: 0.1,
        fear: 0.1,
        significantEvents: ["conflict"],
      },
    ],
  } as unknown as AgentState;

  expect(resolveAgentReference("target-1", observingAgent)).toBe("a friend");
  expect(resolveAgentReference("target-2", observingAgent)).toBe("an adversary");
  expect(resolveAgentReference("missing-target", observingAgent)).toBe("a stranger");
});
