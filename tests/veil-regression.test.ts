import { expect, test } from "bun:test";
import { QualiaProcessor } from "../server/agents/qualia-processor";
import { validateQualiaOutput } from "../server/agents/qualia-validator";
import {
  type AgentState,
  type RawSensorBundle,
  SENSOR_BUNDLE_LENGTH,
  SensorIndex,
  SensorSchemaVersion,
} from "../shared/types";

function createAgent(): AgentState {
  return {
    id: "veil-agent-1",
    speciesId: "proto-human-forager",
    body: {
      physiology: {
        energyReserves: 0.18,
        hydration: 0.1,
        oxygenSaturation: 0.82,
        toxinLoad: 0.25,
        immuneBurden: 0.1,
        health: 0.88,
        fatigue: 0.35,
        coreTemperature: 15,
        actuationEnergyRecent: 0.3,
      },
      energy: 0.18,
      hydration: 0.1,
      oxygenation: 0.82,
      toxinLoad: 0.25,
      fatigue: 0.35,
      coreTemperature: 15,
      inflammation: 0.1,
      painLoad: 0.4,
      health: 0.88,
      bodyMap: {
        head: { pain: 0.2, damage: 0, temperature: 15 },
        torso: { pain: 0.9, damage: 0.1, temperature: 15 },
        leftArm: { pain: 0.1, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0.2, damage: 0, temperature: 15 },
        rightLeg: { pain: 0.3, damage: 0, temperature: 15 },
      },
      arousal: 0.4,
      valence: -0.2,
      cycleHormone: 0.3,
      circadianPhase: 0.5,
      integrityDrive: 0.6,
      recentConsumptions: [],
    },
    currentAction: { type: "REST" },
    episodicStore: [{ qualiaText: "a prior sensation trace", tick: 1, salience: 0.2 }],
    lexicon: [],
    relationships: [],
    semanticStore: [],
  } as unknown as AgentState;
}

function createBundle(agentId: string): RawSensorBundle {
  const readings = new Float32Array(SENSOR_BUNDLE_LENGTH);
  readings[SensorIndex.OralDryness] = 0.92;
  readings[SensorIndex.VisceralContraction] = 0.7;
  readings[SensorIndex.ChestPressure] = 0.25;
  readings[SensorIndex.PainTorso] = 0.9;
  readings[SensorIndex.Taste3] = 0.95;

  return {
    schemaVersion: SensorSchemaVersion.V1,
    agentId,
    tick: 14,
    readings,
    perceptualRefs: [
      {
        ref: "foreground_0",
        kind: "visible_entity",
        operatorEntityId: "operator-hidden-entity",
        operatorMaterialId: "toxic_bitter_plant",
        approximateDirection: "front",
        salience: 0.8,
      },
    ],
  };
}

test("veil regression: intense embodied input still yields valid non-leaking qualia", () => {
  const agent = createAgent();
  const frame = QualiaProcessor.process({
    agent,
    rawSensorBundle: createBundle(agent.id),
    lexicon: [],
    tick: 14,
  });

  const validation = validateQualiaOutput(frame.narratableText, []);
  expect(validation.valid).toBe(true);
  expect(frame.narratableText).not.toMatch(/\b(operator|simulation|database|tick)\b/i);
  expect(frame.narratableText).not.toMatch(/\b(hunger|thirst|drink|water|eat|food)\b/i);
  expect(frame.narratableText).not.toMatch(/\b\d+\.\d{2,}\b/);
});

test("veil regression: same raw sensor bundle yields deterministic narratable text", () => {
  const agent = createAgent();
  const input = {
    agent,
    rawSensorBundle: createBundle(agent.id),
    lexicon: [],
    tick: 14,
  };

  const first = QualiaProcessor.process(input);
  const second = QualiaProcessor.process(input);

  expect(first.narratableText).toBe(second.narratableText);
});
