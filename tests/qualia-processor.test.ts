import { expect, test } from "bun:test";
import { QualiaProcessor } from "../server/agents/qualia-processor";
import type {
  AgentState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
} from "../shared/types";

test("QualiaProcessor: outputs natural language, applies masking, respects lexicon", () => {
  const agent = {
    id: "a1",
    lexicon: [],
    relationships: [],
    semanticStore: [],
  } as unknown as AgentState;

  const filteredPercept: FilteredPercept = {
    primaryAttention: [{ id: "a2" } as unknown as AgentState],
    peripheralAwareness: { count: 1, aggregateEmotionalField: 0 },
    focusedVoxels: [
      { type: 8, material: "fire", temperature: 100, moisture: 0, fertility: 0, lightLevel: 1 },
    ],
    ownBody: {
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15, label: "head" },
        torso: { pain: 0, damage: 0, temperature: 15, label: "torso" },
        leftArm: { pain: 60, damage: 0, temperature: 15, label: "leftArm" }, // high pain
        rightArm: { pain: 0, damage: 0, temperature: 15, label: "rightArm" },
        leftLeg: { pain: 0, damage: 0, temperature: 15, label: "leftLeg" },
        rightLeg: { pain: 0, damage: 0, temperature: 15, label: "rightLeg" },
      },
    } as unknown as AgentState["body"],
  };

  const detections: EmotionalFieldDetection[] = [
    { sourceAgentId: "a2", valenceImpression: -0.8, arousalImpression: 0.5 },
  ];

  const moodTint: FeelingResidueTint = { valence: -0.6, arousal: 0 };

  const cState = {
    lightLevel: 0.1,
    cycleHormoneValue: 0.9,
    season: "winter",
  };

  const wConfig = {
    semanticMasking: {
      enabled: true,
      qualiaUsesRealLabels: false,
      sensorLabelMap: {
        fire: "flux_7",
        chill: "temp_drop",
        heavy: "grav_pull",
      },
    },
  };

  const result = QualiaProcessor.qualiaFor(
    agent,
    filteredPercept,
    detections,
    moodTint,
    cState,
    wConfig,
  );

  // Checks:
  // 1. No JSON, ID, etc.
  expect(result).not.toContain("{");
  expect(result).not.toContain("a2");

  // 2. Mood tint
  expect(result).toContain("grav_pull shadow");

  // 3. Circadian logic
  expect(result).toContain("grav_pull"); // "heavy" masked
  expect(result).toContain("different in a way");

  // 4. Body logic
  expect(result).toContain("burning in your left arm");

  // 5. Emotion logic
  expect(result).toContain("uneasy");

  // 6. Agent relation
  expect(result).toContain("unfamiliar presence");

  // 7. Fire without lexicon
  expect(result).toContain("hot, bright substance");
  expect(result).not.toContain("flux_7"); // because fire isn't in output when not in lexicon, "hot, bright substance" is used
});
