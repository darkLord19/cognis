import { expect, test } from "bun:test";
import type {
  AgentId,
  AgentState,
  BodyState,
  HostId,
  HostState,
  RawSensorBundle,
} from "../shared/types";
import { SENSOR_BUNDLE_LENGTH, SensorIndex, SensorSchemaVersion } from "../shared/types";

test("v5.2: HostId and HostState are compatibility aliases", () => {
  const agentId: AgentId = "agent-1";
  const hostId: HostId = agentId;
  const hostState: HostState = {} as AgentState;

  expect(hostId).toBe("agent-1");
  expect(hostState).toBeDefined();
});

test("v5.2: BodyState supports physiology + deprecated compatibility fields", () => {
  const body = {
    physiology: {
      energyReserves: 0.8,
      hydration: 0.7,
      oxygenSaturation: 1,
      toxinLoad: 0,
      immuneBurden: 0.1,
      health: 0.9,
      fatigue: 0.2,
      coreTemperature: 15,
      actuationEnergyRecent: 0,
    },
    energy: 0.8,
    hydration: 0.7,
    oxygenation: 1,
    toxinLoad: 0,
    inflammation: 0.1,
    painLoad: 0,
    fatigue: 0.2,
    health: 0.9,
    coreTemperature: 15,
    hunger: 0.2,
    thirst: 0.3,
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
    cycleFlux: 0.3,
    circadianPhase: 0.5,
    integrityDrive: 0.1,
    recentConsumptions: [],
  } satisfies BodyState;

  expect(body.physiology.energyReserves).toBe(0.8);
  expect(body.hunger).toBe(0.2);
});

test("v5.2: sensor bundle is versioned and fixed-width", () => {
  const bundle: RawSensorBundle = {
    schemaVersion: SensorSchemaVersion.V1,
    agentId: "agent-7",
    tick: 42,
    readings: new Float32Array(SENSOR_BUNDLE_LENGTH),
    perceptualRefs: [],
  };

  bundle.readings[SensorIndex.OralDryness] = 0.45;
  expect(bundle.readings.length).toBe(64);
  expect(bundle.readings[SensorIndex.OralDryness]).toBeCloseTo(0.45, 5);
});
