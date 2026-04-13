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
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15 },
        torso: { pain: 0, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
    },
    lexicon: [],
    relationships: [],
    semanticStore: [],
  }) as unknown as AgentState;

const createPercept = (pain = 0, hunger = 0, thirst = 0): FilteredPercept =>
  ({
    primaryAttention: [],
    peripheralAwareness: { count: 0, aggregateEmotionalField: 0 },
    focusedVoxels: [],
    ownBody: {
      hunger,
      thirst,
      fatigue: 0.2,
      health: 0.9,
      coreTemperature: 15,
      valence: 0,
      arousal: 0,
      bodyMap: {
        head: { pain, damage: 0, temperature: 15 },
        torso: { pain: 0, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
    } as unknown as AgentState["body"],
  }) as FilteredPercept;

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

test("QualiaProcessor outputs vectorized qualia channels", () => {
  const agent = createTestAgent();
  const percept = createPercept(0.7, 0.6, 0.4);

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: -0.2, arousal: 0.4 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("interoceptive_map(");
  expect(result).toContain("ambient_map(");
  expect(result).toContain("affect_map(");
  expect(result).toContain("impact=");
  expect(result).not.toContain("{");
});

test("QualiaProcessor renders unknown external concepts as undifferentiated", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  percept.focusedVoxels = [
    { material: "fire", temperature: 100 } as unknown as (typeof percept.focusedVoxels)[0],
  ];

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("undifferentiated");
});

test("QualiaProcessor describes biomass with metallic sweetness cue", () => {
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

  expect(result).toContain("heavy metallic sweetness");
});

test("QualiaProcessor uses lexicon token when concept is available", () => {
  const agent = createTestAgent();
  agent.lexicon = [{ word: "grok", concept: "fire", confidence: 0.8, consensusCount: 1 }];

  const percept = createPercept();
  percept.focusedVoxels = [
    { material: "fire", temperature: 100 } as unknown as (typeof percept.focusedVoxels)[0],
  ];

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("grok");
  expect(result).not.toContain("undifferentiated:fire");
});

test("QualiaProcessor redacts forbidden substrate terms", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  percept.focusedVoxels = [
    { material: "fire", temperature: 100 } as unknown as (typeof percept.focusedVoxels)[0],
  ];

  const maskedConfig = {
    ...defaultConfig,
    semanticMasking: {
      enabled: true,
      qualiaUsesRealLabels: false,
      sensorLabelMap: {
        grok: "simulation",
      },
    },
  } as unknown as WorldConfig;

  agent.lexicon = [{ word: "grok", concept: "fire", confidence: 0.8, consensusCount: 1 }];

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    maskedConfig,
  );

  expect(result).not.toMatch(/\bsimulation\b/i);
  expect(result).toContain("veil");
});

test("QualiaProcessor captures social and affective vectors", () => {
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
  const moodTint: FeelingResidueTint = { valence: -0.7, arousal: 0.2 };

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    detections,
    moodTint,
    neutralCircadian,
    defaultConfig,
  );

  expect(result).toContain("social_map(");
  expect(result).toContain("affect_map(");
  expect(result).toContain("prox=1");
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

  expect(resolveAgentReference("target-1", observingAgent)).toBe("bonded");
  expect(resolveAgentReference("target-2", observingAgent)).toBe("averse");
  expect(resolveAgentReference("missing-target", observingAgent)).toBe("unknown");
});
