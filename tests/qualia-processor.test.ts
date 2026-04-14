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
      physiology: {
        energyReserves: 0.2,
        hydration: 0.15,
        oxygenSaturation: 0.8,
        toxinLoad: 0.1,
        immuneBurden: 0.1,
        health: 0.9,
        fatigue: 0.2,
        coreTemperature: 15,
        actuationEnergyRecent: 0,
      },
      energy: 0.2,
      hydration: 0.15,
      fatigue: 0.1,
      health: 0.9,
      oxygenation: 0.8,
      toxinLoad: 0.1,
      inflammation: 0.1,
      painLoad: 0,
      integrityDrive: 0.4,
      bodyMap: {
        head: { pain: 0.4, damage: 0, temperature: 15 },
        torso: { pain: 0.2, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
      arousal: 0.2,
      valence: 0.1,
      cycleHormone: 0.3,
      circadianPhase: 0.5,
      recentConsumptions: [],
    },
    lexicon: [],
    relationships: [],
    semanticStore: [],
    episodicStore: [],
  }) as unknown as AgentState;

const createPercept = (): FilteredPercept =>
  ({
    primaryAttention: [
      {
        id: "a2",
      } as unknown as AgentState,
    ],
    peripheralAwareness: { count: 1, aggregateEmotionalField: 0 },
    focusedVoxels: [],
    ownBody: {} as AgentState["body"],
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

const noDetections: EmotionalFieldDetection[] = [];
const neutralMood: FeelingResidueTint = { valence: 0, arousal: 0 };

test("QualiaProcessor outputs deterministic sensation-first narrative", () => {
  const agent = createTestAgent();
  const percept = createPercept();

  const first = QualiaProcessor.qualiaFor(
    agent,
    percept,
    noDetections,
    neutralMood,
    neutralCircadian,
    defaultConfig,
  );
  const second = QualiaProcessor.qualiaFor(
    agent,
    percept,
    noDetections,
    neutralMood,
    neutralCircadian,
    defaultConfig,
  );

  expect(first.length).toBeGreaterThan(0);
  expect(first).toBe(second);
});

test("QualiaProcessor blocks forbidden substrate leaks and decimal telemetry", () => {
  const agent = createTestAgent();
  const percept = createPercept();

  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    noDetections,
    neutralMood,
    neutralCircadian,
    defaultConfig,
  );

  expect(result).not.toMatch(/\bsimulation\b/i);
  expect(result).not.toMatch(/\bcode\b/i);
  expect(result).not.toMatch(/\b\d+\.\d{2,}\b/);
  expect(result).not.toMatch(/\bx\s*:/i);
});

test("QualiaProcessor avoids explicit survival concept spoilers by default", () => {
  const agent = createTestAgent();
  const percept = createPercept();
  const result = QualiaProcessor.qualiaFor(
    agent,
    percept,
    noDetections,
    neutralMood,
    neutralCircadian,
    defaultConfig,
  );

  expect(result).not.toMatch(/\bhunger|thirst|drink|water|eat|food\b/i);
});

test("QualiaProcessor resolveAgentReference is relation-based and non-naming", () => {
  const observingAgent = {
    relationships: [
      {
        targetAgentId: "target-1",
        affinity: 0.8,
      },
      {
        targetAgentId: "target-2",
        affinity: -0.8,
      },
    ],
  } as unknown as AgentState;

  expect(resolveAgentReference("target-1", observingAgent)).toBe("a friend");
  expect(resolveAgentReference("target-2", observingAgent)).toBe("an adversary");
  expect(resolveAgentReference("missing-target", observingAgent)).toBe("a stranger");
});
