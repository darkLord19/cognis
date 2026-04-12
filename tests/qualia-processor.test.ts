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

const createTestAgent = (): AgentState => {
  return {
    id: "a1",
    lexicon: [],
    relationships: [],
    semanticStore: [],
  } as unknown as AgentState;
};

const createPercept = (pain = 0, hunger = 0, thirst = 0): FilteredPercept => ({
  primaryAttention: [],
  peripheralAwareness: { count: 0, aggregateEmotionalField: 0 },
  focusedVoxels: [],
  ownBody: {
    hunger,
    thirst,
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
});

const neutralCircadian: CircadianState = {
  lightLevel: 0.5,
  cycleHormoneValue: 0.5,
  season: "spring",
  surfaceTemperatureDelta: 0,
};

const defaultConfig = {
  semanticMasking: {
    enabled: false,
    qualiaUsesRealLabels: true,
    sensorLabelMap: {},
  },
} as unknown as WorldConfig;

test("QualiaProcessor: outputs natural language, no JSON or IDs", () => {
  const agent = createTestAgent();
  const percept = createPercept(0.6); // high pain in head

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  // No JSON or agent IDs
  expect(result).not.toContain("{");
  expect(result).not.toContain("a1");
  // Should mention burning (pain > 0.5)
  expect(result.toLowerCase()).toContain("burn");
});

test("QualiaProcessor: negative mood tint adds heavy/dark text", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  const moodTint: FeelingResidueTint = { valence: -0.7, arousal: 0 };

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    moodTint,
    neutralCircadian,
    defaultConfig,
  );

  // Should produce mood text containing "heavy" or "shadow" or "dark"
  const lower = result.toLowerCase();
  expect(lower.includes("heavy") || lower.includes("shadow") || lower.includes("dark")).toBe(true);
});

test("QualiaProcessor: circadian body_heavy at high hormone + low light", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  const nightCircadian: CircadianState = {
    ...neutralCircadian,
    lightLevel: 0.1,
    cycleHormoneValue: 0.9,
    season: "winter",
  };

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    nightCircadian,
    defaultConfig,
  );

  const lower = result.toLowerCase();
  // body_heavy or season change text
  expect(
    lower.includes("heavy") || lower.includes("stillness") || lower.includes("different"),
  ).toBe(true);
});

test("QualiaProcessor: emotional field detection produces unease text", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  const detections: EmotionalFieldDetection[] = [
    { sourceAgentId: "a2", valenceImpression: -0.8, arousalImpression: 0.5 },
  ];

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    detections,
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );

  expect(result.toLowerCase()).toContain("uneasy");
});

test("QualiaProcessor: fire voxel without lexicon uses unknown template", () => {
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

  const lower = result.toLowerCase();
  // fire_unknown template: "hot" or "bright" or "heat"
  expect(
    lower.includes("hot") ||
      lower.includes("bright") ||
      lower.includes("heat") ||
      lower.includes("warm"),
  ).toBe(true);
});

test("QualiaProcessor: semantic masking replaces labels", () => {
  const agent = createTestAgent();
  agent.lexicon = [{ word: "grok", concept: "fire", confidence: 0.8, consensusCount: 1 }];
  const percept = createPercept();
  percept.focusedVoxels = [
    { material: "fire", temperature: 100 } as unknown as (typeof percept.focusedVoxels)[0],
  ];

  const maskedConfig = {
    semanticMasking: {
      enabled: true,
      qualiaUsesRealLabels: false,
      sensorLabelMap: { fire: "flux_7" },
    },
  } as unknown as WorldConfig;

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    maskedConfig,
  );

  // If "fire" appeared in output, it should be replaced by "flux_7"
  expect(result).not.toContain("fire");
});

test("QualiaProcessor: hunger rendering at mild and strong", () => {
  const agent = createTestAgent();

  // Mild hunger
  const mildPercept = createPercept(0, 0.5, 0);
  const mildResult = QualiaProcessor.qualiaFor(
    agent,
    mildPercept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );
  const mildLower = mildResult.toLowerCase();
  expect(
    mildLower.includes("hollow") || mildLower.includes("empty") || mildLower.includes("hunger"),
  ).toBe(true);

  // Strong hunger
  const strongPercept = createPercept(0, 0.8, 0);
  const strongResult = QualiaProcessor.qualiaFor(
    agent,
    strongPercept,
    [],
    { valence: 0, arousal: 0 },
    neutralCircadian,
    defaultConfig,
  );
  const strongLower = strongResult.toLowerCase();
  expect(
    strongLower.includes("hunger") ||
      strongLower.includes("desperate") ||
      strongLower.includes("ravenous") ||
      strongLower.includes("claws"),
  ).toBe(true);
});

test("QualiaProcessor: resolveAgentReference uses relationship context, not names", () => {
  const observingAgent = {
    relationships: [
      {
        targetAgentId: "target-1",
        affinity: 0.8,
        trust: 0.7,
        fear: 0.1,
        significantEvents: ["shared food"],
      },
    ],
  } as unknown as AgentState;

  expect(resolveAgentReference("target-1", observingAgent)).toBe("someone you trust");
  expect(resolveAgentReference("missing-target", observingAgent)).toBe("an unknown presence");
});
