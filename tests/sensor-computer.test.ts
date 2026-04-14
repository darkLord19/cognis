import { expect, test } from "bun:test";
import { SenseComputer } from "../server/perception/sense-computer";
import { SpatialIndex } from "../server/world/spatial-index";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { AgentState, CircadianState, PerceptionConfig } from "../shared/types";
import { SensorIndex, SensorSchemaVersion } from "../shared/types";

function createAgent(id: string): AgentState {
  return {
    id,
    speciesId: "proto_human",
    name: id,
    generation: 1,
    body: {
      physiology: {
        energyReserves: 0.7,
        hydration: 0.2,
        oxygenSaturation: 0.9,
        toxinLoad: 0.1,
        immuneBurden: 0.1,
        health: 0.9,
        fatigue: 0.3,
        coreTemperature: 15,
        actuationEnergyRecent: 0.1,
      },
      energy: 0.7,
      hydration: 0.2,
      toxinLoad: 0.1,
      oxygenation: 0.9,
      fatigue: 0.3,
      coreTemperature: 15,
      inflammation: 0.1,
      painLoad: 0,
      health: 0.9,
      bodyMap: {
        head: { pain: 0, temperature: 15, damage: 0 },
        torso: { pain: 0.2, temperature: 15, damage: 0 },
        leftArm: { pain: 0.5, temperature: 15, damage: 0 },
        rightArm: { pain: 0.1, temperature: 15, damage: 0 },
        leftLeg: { pain: 0, temperature: 15, damage: 0 },
        rightLeg: { pain: 0, temperature: 15, damage: 0 },
      },
      arousal: 0.2,
      valence: 0.1,
      cycleHormone: 0.3,
      cycleFlux: 0.3,
      circadianPhase: 0.5,
      integrityDrive: 0.2,
      mouthItem: {
        perceptualRef: "mouth_item",
        materialId: "toxic_bitter_plant",
        quantity: 1,
        enteredMouthAtTick: 1,
      },
      recentConsumptions: [],
    },
    position: { x: 0, y: 0, z: 0 },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: { strength: 0.5, speed: 0.4, endurance: 0.6 },
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

const config: PerceptionConfig = {
  physicsLimitsEnabled: true,
  emotionalFieldEnabled: true,
  emotionalFieldSuppressible: true,
  feelingResidueEnabled: true,
  residueDecayRate: 0.1,
  qualiaFidelity: "standard",
  attentionFilterEnabled: true,
  attentionCapacity: 5,
  attentionWeights: {
    relationshipStrength: 0.3,
    emotionalFieldIntensity: 0.3,
    movementVelocity: 0.2,
    novelty: 0.2,
  },
};

const state: CircadianState = {
  lightLevel: 1,
  surfaceTemperatureDelta: 0,
  cycleHormoneValue: 0.2,
  season: "spring",
};

test("SensorComputer: produces deterministic v1 raw sensor bundle", () => {
  const world = new VoxelGrid(12, 12, 12);
  const index = new SpatialIndex();
  const agent = createAgent("a1");
  const other = createAgent("a2");
  other.position.x = 2;
  index.rebuildIndex([agent, other]);

  const bundleA = SenseComputer.computeSensorBundle(agent, world, index, config, state, []);
  const bundleB = SenseComputer.computeSensorBundle(agent, world, index, config, state, []);

  expect(bundleA.schemaVersion).toBe(SensorSchemaVersion.V1);
  expect(bundleA.readings.length).toBe(64);
  expect(Array.from(bundleA.readings)).toEqual(Array.from(bundleB.readings));
  expect(bundleA.perceptualRefs.length).toBeGreaterThan(0);
});

test("SensorComputer: oral dryness and taste channels reflect embodied state", () => {
  const world = new VoxelGrid(10, 10, 10);
  const index = new SpatialIndex();
  const agent = createAgent("a1");
  index.rebuildIndex([agent]);

  const withTaste = SenseComputer.computeSensorBundle(agent, world, index, config, state, []);
  expect(withTaste.readings[SensorIndex.OralDryness]).toBeGreaterThan(0.5);
  expect(withTaste.readings[SensorIndex.Taste3]).toBeGreaterThan(0.5);

  delete agent.body.mouthItem;
  const withoutTaste = SenseComputer.computeSensorBundle(agent, world, index, config, state, []);
  expect(withoutTaste.readings[SensorIndex.Taste3]).toBe(0);
});
