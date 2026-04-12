import { beforeAll, expect, test } from "bun:test";
import { System2 } from "../server/agents/system2";
import { EventBus } from "../server/core/event-bus";
import { Orchestrator } from "../server/core/orchestrator";
import { SimClock } from "../server/core/sim-clock";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { PhysicsEngine } from "../server/world/physics-engine";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { AgentState, PhysicsPreset, WorldConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM semantic_beliefs");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const mockPreset: PhysicsPreset = {
  name: "earth",
  gravity: 9.8,
  atmospherePressure: 1.0,
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
  thermalConductivity: { stone: 0, dirt: 0, wood: 0, water: 0, ore: 0, food: 0, air: 0, fire: 0 },
};

const mockConfig: WorldConfig = {
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
  physics: mockPreset,
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
    semanticCapacity: 1000,
    semanticDecayRate: 0.05,
    suppressionDecayRate: 0.5,
  },
  freeWill: {
    enabled: true,
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
  semanticMasking: { enabled: false },
  time: { elasticHeartbeat: false, maxHeartbeatWaitMs: 5000, tickDurationMs: 10 },
} as unknown as WorldConfig;

const createAgent = (id: string): AgentState => {
  return {
    id,
    name: `Agent ${id}`,
    body: {
      hunger: 0,
      thirst: 0,
      fatigue: 0,
      health: 100,
      valence: 0,
      arousal: 0,
      integrityDrive: 0,
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15 },
        torso: { pain: 0, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
    },
    position: { x: 0, y: 5, z: 0 },
    muscleStats: { strength: 0.5, speed: 0.5, endurance: 0.5 },
    relationships: [],
    lexicon: [],
    semanticStore: [],
    feelingResidues: [],
    episodicStore: [],
    mentalModels: {},
  } as unknown as AgentState;
};

test("Orchestrator: Integration test with 5 agents, 20 ticks", async () => {
  const world = new VoxelGrid(10, 10, 10);
  const clock = new SimClock();
  const eventBus = new EventBus();
  const physics = new PhysicsEngine(mockPreset);
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const orchestrator = new Orchestrator(
    "run1",
    "main",
    mockConfig,
    world,
    clock,
    eventBus,
    physics,
    system2,
  );

  for (let i = 0; i < 5; i++) {
    orchestrator.addAgent(createAgent(`a${i}`));
  }

  for (let t = 0; t < 20; t++) {
    await clock.advanceTick();
    await orchestrator.tick();
  }

  expect(clock.getTick()).toBe(20);
});
