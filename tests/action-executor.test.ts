import { expect, test } from "bun:test";
import { ActionExecutor } from "../server/agents/action-executor";
import { ActuationType, type MotorPlan } from "../server/agents/action-grammar";
import { EventBus } from "../server/core/event-bus";
import { EventType } from "../shared/events";
import type { AgentState } from "../shared/types";

function createAgent(): AgentState {
  return {
    id: "agent-1",
    speciesId: "human",
    name: "Agent 1",
    generation: 1,
    body: {
      physiology: {
        energyReserves: 0.8,
        hydration: 0.7,
        oxygenSaturation: 1,
        toxinLoad: 0,
        immuneBurden: 0.1,
        health: 1,
        fatigue: 0.2,
        coreTemperature: 15,
        actuationEnergyRecent: 0,
      },
      energy: 0.8,
      hydration: 0.7,
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
      mouthItem: {
        perceptualRef: "mouth_item",
        materialId: "fresh_water",
        quantity: 1,
        enteredMouthAtTick: 1,
      },
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

test("action executor: rejects swallow target that is not mouth_item perceptual ref", () => {
  const bus = new EventBus();
  const executor = new ActionExecutor(bus);
  const agent = createAgent();

  const plan = {
    source: "system2",
    urgency: 0.7,
    createdAtTick: 3,
    primitives: [
      {
        type: ActuationType.SWALLOW,
        target: { materialId: "fresh_water" },
        intensity: 1,
        durationTicks: 1,
      },
    ],
  } as unknown as MotorPlan;

  const [result] = executor.executeMotorPlan(agent, plan, 3, "run-1", "main");
  expect(result?.success).toBe(false);
  expect(result?.failureReason).toBe("invalid_state");
});

test("action executor: swallow succeeds only with mouth_item perceptual ref", () => {
  const events: EventType[] = [];
  const bus = new EventBus();
  bus.onAny((event) => {
    events.push(event.type);
  });

  const executor = new ActionExecutor(bus);
  const agent = createAgent();
  const plan: MotorPlan = {
    source: "system2",
    urgency: 0.8,
    createdAtTick: 4,
    primitives: [
      {
        type: ActuationType.SWALLOW,
        target: { type: "perceptual_ref", ref: "mouth_item" },
        intensity: 1,
        durationTicks: 1,
      },
    ],
  };

  const [result] = executor.executeMotorPlan(agent, plan, 4, "run-1", "main");
  expect(result?.success).toBe(true);
  expect(agent.body.mouthItem).toBeUndefined();
  expect(events.includes(EventType.ACTION_SUCCEEDED)).toBe(true);
});
