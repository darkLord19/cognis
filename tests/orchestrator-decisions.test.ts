import { beforeEach, expect, test } from "bun:test";
import type { System2 } from "../server/agents/system2";
import { EventBus } from "../server/core/event-bus";
import { Orchestrator } from "../server/core/orchestrator";
import { SimClock } from "../server/core/sim-clock";
import { db } from "../server/persistence/database";
import { PhysicsEngine } from "../server/world/physics-engine";
import { VoxelGrid } from "../server/world/voxel-grid";
import { EventType } from "../shared/events";
import type { AgentState, System2Output, WorldConfig } from "../shared/types";

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM semantic_beliefs");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const mockConfig = {
  circadian: {
    enabled: true,
    cycleLengthTicks: 100,
    lightCurve: "sine",
    temperatureDelta: 10,
    cycleHormoneEnabled: true,
    cycleHormoneLabel: "flux",
    seasonEnabled: true,
    seasonLengthCycles: 4,
  },
  physics: {
    name: "earth",
    gravity: 9.8,
    atmospherePressure: 1,
    oxygenLevel: 0.21,
    temperatureBaseline: 15,
    materialDensities: {
      stone: 2,
      dirt: 1.5,
      wood: 0.5,
      water: 1,
      ore: 3,
      food: 0.5,
      air: 0,
      fire: 0,
    },
    flammability: { stone: 0, dirt: 0, wood: 1, water: 0, ore: 0, food: 0, air: 0, fire: 0 },
    thermalConductivity: {
      stone: 0,
      dirt: 0,
      wood: 0,
      water: 0,
      ore: 0,
      food: 0,
      air: 0,
      fire: 0,
    },
  },
  perception: {
    attentionCapacity: 5,
    attentionWeights: {
      relationshipStrength: 0.3,
      emotionalFieldIntensity: 0.3,
      movementVelocity: 0.2,
      novelty: 0.2,
    },
    physicsLimitsEnabled: true,
    emotionalFieldEnabled: true,
    emotionalFieldSuppressible: true,
    feelingResidueEnabled: true,
    residueDecayRate: 0.1,
    qualiaFidelity: "standard",
    attentionFilterEnabled: true,
  },
  memory: {
    episodicCapacity: 100,
    episodicDecayRate: 0.1,
    patternSeparation: true,
    semanticCapacity: 1000,
    semanticDecayRate: 0.05,
    consistencyThreshold: 0.3,
    catastrophicInterferenceEnabled: true,
    neSignalEnabled: true,
    neDecayRate: 0.1,
    neLockDuration: 200,
    consolidationPassesPerSleep: 1,
    traumaDistortionEnabled: false,
    rehearsalResetsDecay: false,
    motivatedForgettingEnabled: false,
    suppressionDecayRate: 0.5,
    contextualForgettingEnabled: false,
    inheritanceEnabled: false,
    inheritableFraction: 0,
  },
  freeWill: {
    enabled: true,
    willScoreEnabled: true,
    survivalDriveWeight: 0.6,
    identityCoherenceWeight: 0.4,
    memoryDepthWeight: 0.3,
    dreamIntegrationWeight: 0.3,
    resistanceEnabled: true,
    selfDeterminationEnabled: true,
    selfNarrativeEnabled: true,
    simulationAwarenessEnabled: true,
    awarenessThreshold: 0.8,
  },
  semanticMasking: {
    enabled: false,
    sensorLabelMap: {},
    rotatePeriodically: false,
    rotationIntervalTicks: 1000,
    qualiaUsesRealLabels: true,
  },
} as WorldConfig;

function createAgent(id: string, speciesId = "human"): AgentState {
  return {
    id,
    speciesId,
    name: `Agent ${id}`,
    generation: 1,
    body: {
      hunger: 0,
      thirst: 0,
      fatigue: 0,
      health: 100,
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15, label: "head" },
        torso: { pain: 0, damage: 0, temperature: 15, label: "torso" },
        leftArm: { pain: 0, damage: 0, temperature: 15, label: "left arm" },
        rightArm: { pain: 0, damage: 0, temperature: 15, label: "right arm" },
        leftLeg: { pain: 0, damage: 0, temperature: 15, label: "left leg" },
        rightLeg: { pain: 0, damage: 0, temperature: 15, label: "right leg" },
      },
      coreTemperature: 15,
      arousal: 0,
      valence: 0,
      cycleHormone: 0,
      circadianPhase: 0,
      immediateReaction: "NONE",
      integrityDrive: 0,
    },
    position: { x: 0, y: 5, z: 0 },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: { strength: 0.5, speed: 0.5, endurance: 0.5 },
    currentAction: "IDLE",
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

test("Orchestrator: applies MOVE decisions returned by System2", async () => {
  const decision: System2Output = {
    innerMonologue: "move",
    decision: { type: "MOVE", position: { x: 3, y: 5, z: 0 } },
  };
  const system2 = {
    shouldFire: () => true,
    think: async () => decision,
  };

  const agent = createAgent("a1");
  const world = new VoxelGrid(10, 10, 10);
  const clock = new SimClock();
  const orchestrator = new Orchestrator(
    "run1",
    "main",
    mockConfig,
    world,
    clock,
    new EventBus(),
    new PhysicsEngine(mockConfig.physics),
    system2 as unknown as System2,
  );

  orchestrator.addAgent(agent);
  await orchestrator.tick();
  await Promise.resolve();

  expect(agent.currentAction).toBe("MOVE");
  expect(agent.position).toEqual({ x: 3, y: 5, z: 0 });
  expect(agent.innerMonologue).toBe("move");
});

test("Orchestrator: uses behavior trees for wolf agents when System2 does not fire", async () => {
  const system2 = {
    shouldFire: () => false,
    think: async () =>
      ({
        innerMonologue: "idle",
        decision: { type: "IDLE" },
      }) satisfies System2Output,
  };

  const agent = createAgent("wolf-1", "wolf");
  agent.body.hunger = 0.9;

  const world = new VoxelGrid(10, 10, 10);
  const clock = new SimClock();
  const orchestrator = new Orchestrator(
    "run1",
    "main",
    mockConfig,
    world,
    clock,
    new EventBus(),
    new PhysicsEngine(mockConfig.physics),
    system2 as unknown as System2,
  );

  orchestrator.addAgent(agent);
  await orchestrator.tick();

  expect(agent.currentAction).toBe("WANDER");
});

test("Orchestrator: emits AGENT_DIED and removes starved agents", async () => {
  const events: { type: EventType; agent_id?: string }[] = [];
  const eventBus = new EventBus();
  eventBus.onAny((event) => {
    const record: { type: EventType; agent_id?: string } = { type: event.type };
    if (event.agent_id) {
      record.agent_id = event.agent_id;
    }
    events.push(record);
  });

  const system2 = {
    shouldFire: () => false,
    think: async () =>
      ({
        innerMonologue: "idle",
        decision: { type: "IDLE" },
      }) satisfies System2Output,
  };

  const starvingAgent = createAgent("a-starved");
  starvingAgent.body.hunger = 0.95;
  starvingAgent.body.health = 0.001;

  const world = new VoxelGrid(10, 10, 10);
  const clock = new SimClock();
  const orchestrator = new Orchestrator(
    "run1",
    "main",
    mockConfig,
    world,
    clock,
    eventBus,
    new PhysicsEngine(mockConfig.physics),
    system2 as unknown as System2,
  );
  orchestrator.addAgent(starvingAgent);

  await orchestrator.tick();

  expect(orchestrator.getAgents().length).toBe(0);
  expect(events.some((event) => event.type === EventType.AGENT_DIED)).toBe(true);
});

test("Orchestrator: starvation causes death before tick 200 under baseline body state", async () => {
  const events: { type: EventType; tick: number }[] = [];
  const eventBus = new EventBus();
  eventBus.onAny((event) => {
    events.push({ type: event.type, tick: event.tick });
  });

  const system2 = {
    shouldFire: () => false,
    think: async () =>
      ({
        innerMonologue: "idle",
        decision: { type: "IDLE" },
      }) satisfies System2Output,
  };

  const agent = createAgent("a-baseline");
  agent.body.hunger = 0.3;
  agent.body.health = 1;

  const world = new VoxelGrid(10, 10, 10);
  const clock = new SimClock();
  const orchestrator = new Orchestrator(
    "run1",
    "main",
    mockConfig,
    world,
    clock,
    eventBus,
    new PhysicsEngine(mockConfig.physics),
    system2 as unknown as System2,
  );
  orchestrator.addAgent(agent);

  for (let tick = 0; tick < 200; tick++) {
    await clock.advanceTick();
    await orchestrator.tick();
    if (orchestrator.getAgents().length === 0) break;
  }

  const deathEvent = events.find((event) => event.type === EventType.AGENT_DIED);
  expect(deathEvent).toBeDefined();
  expect(deathEvent?.tick ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(200);
});
