import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import { System0 } from "../server/agents/system0";
import {
  type AgentState,
  type RawSensorBundle,
  SENSOR_BUNDLE_LENGTH,
  SensorIndex,
  SensorSchemaVersion,
} from "../shared/types";

function createAgent(): AgentState {
  return {
    id: "agent-1",
    speciesId: "human",
    name: "Agent 1",
    generation: 1,
    body: {
      physiology: {
        energyReserves: 0.8,
        hydration: 0.8,
        oxygenSaturation: 1,
        toxinLoad: 0,
        immuneBurden: 0.1,
        health: 1,
        fatigue: 0.2,
        coreTemperature: 15,
        actuationEnergyRecent: 0,
      },
      energy: 0.8,
      hydration: 0.8,
      toxinLoad: 0,
      oxygenation: 1,
      fatigue: 0.2,
      coreTemperature: 15,
      inflammation: 0.1,
      painLoad: 0,
      health: 1,
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
      integrityDrive: 0.1,
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

test("system0: pain withdrawal emits locomote-away reflex", () => {
  const agent = createAgent();
  agent.body.bodyMap.leftArm.pain = 0.9;

  const reflexes = new System0().execute({ agent, tick: 5 });
  const painReflex = reflexes.find((reflex) => reflex.id === "pain_withdrawal");

  expect(painReflex?.fired).toBe(true);
  expect(painReflex?.motorPlan?.primitives[0]?.type).toBe(ActuationType.LOCOMOTE_AWAY);
});

test("system0: respiratory gasp fires from chest pressure sensor", () => {
  const agent = createAgent();
  const bundle: RawSensorBundle = {
    schemaVersion: SensorSchemaVersion.V1,
    agentId: agent.id,
    tick: 8,
    readings: new Float32Array(SENSOR_BUNDLE_LENGTH),
    perceptualRefs: [],
  };
  bundle.readings[SensorIndex.ChestPressure] = 0.95;

  const reflexes = new System0().execute({ agent, sensorBundle: bundle, tick: 8 });
  const reflex = reflexes.find((entry) => entry.id === "respiratory_gasp");

  expect(reflex?.fired).toBe(true);
  expect(reflex?.motorPlan?.primitives[0]?.type).toBe(ActuationType.LOCOMOTE_TOWARD);
});

test("system0: collapse reflex fires at critically low health", () => {
  const agent = createAgent();
  agent.body.health = 0.01;

  const reflexes = new System0().execute({ agent, tick: 9 });
  const collapse = reflexes.find((entry) => entry.id === "collapse");

  expect(collapse?.fired).toBe(true);
  expect(collapse?.motorPlan?.primitives[0]?.type).toBe(ActuationType.LIE_DOWN);
});
