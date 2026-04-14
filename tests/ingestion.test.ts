import { expect, test } from "bun:test";
import { processMouthContact, processSwallow } from "../server/world/ingestion";
import { V1_MATERIALS } from "../server/world/material-affordances";
import type { AgentState } from "../shared/types";

function createAgent(): AgentState {
  return {
    id: "agent-1",
    speciesId: "proto_human",
    name: "Agent 1",
    generation: 1,
    body: {
      physiology: {
        energyReserves: 0.6,
        hydration: 0.4,
        oxygenSaturation: 1,
        toxinLoad: 0.1,
        immuneBurden: 0.1,
        health: 1,
        fatigue: 0.2,
        coreTemperature: 15,
        actuationEnergyRecent: 0,
      },
      energy: 0.6,
      hydration: 0.4,
      toxinLoad: 0.1,
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

function requiredMaterial(id: keyof typeof V1_MATERIALS) {
  const material = V1_MATERIALS[id];
  if (!material) {
    throw new Error(`Missing test material: ${id}`);
  }
  return material;
}

test("ingestion: swallow of fresh water improves hydration immediately", () => {
  const result = processSwallow({
    agent: createAgent(),
    material: requiredMaterial("fresh_water"),
    quantity: 1,
    speciesId: "proto_human",
    tick: 10,
  });

  expect(result.immediatePhysiologyDelta.hydration).toBeGreaterThan(0);
  expect(result.delayedConsumption).toBeUndefined();
});

test("ingestion: toxic material schedules delayed consequence", () => {
  const toxic = requiredMaterial("toxic_bitter_plant");
  const result = processSwallow({
    agent: createAgent(),
    material: toxic,
    quantity: 1,
    speciesId: "proto_human",
    tick: 20,
  });

  expect(result.delayedConsumption).toBeDefined();
  expect(result.delayedConsumption?.materialId).toBe(toxic.id);
  expect(result.delayedConsumption?.onsetTick).toBe(20 + toxic.toxicityOnsetTicks);
});

test("ingestion: mouth contact is sensory-first and does not metabolize yet", () => {
  const result = processMouthContact({
    agent: createAgent(),
    material: requiredMaterial("edible_soft_plant"),
    quantity: 1,
    speciesId: "proto_human",
    tick: 1,
  });

  expect(Object.keys(result.immediatePhysiologyDelta).length).toBe(0);
});
