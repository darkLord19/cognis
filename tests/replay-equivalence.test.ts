import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { bootstrapSimulation } from "../server/core/bootstrap";
import { EventBus } from "../server/core/event-bus";
import { RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";
import type { LLMGateway } from "../server/llm/gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";
import type { WorldConfig } from "../shared/types";

function testConfig(): WorldConfig {
  return {
    meta: {
      name: "replay-equivalence",
      seed: 3201,
      version: "1.0",
      learnabilityNote: "deterministic bootstrap replay",
    },
    physics: {
      name: "earth",
      gravity: 9.8,
      atmospherePressure: 1,
      oxygenLevel: 0.21,
      temperatureBaseline: 15,
      materialDensities: { stone: 2.5, dirt: 1.2, water: 1, air: 0.001 },
      flammability: { stone: 0, dirt: 0, water: 0, air: 0 },
      thermalConductivity: { stone: 0.5, dirt: 0.3, water: 0.6, air: 0.02 },
    },
    circadian: {
      enabled: true,
      cycleLengthTicks: 240,
      lightCurve: "sine",
      temperatureDelta: 4,
      cycleHormoneEnabled: true,
      cycleHormoneLabel: "cycle_flux",
      seasonEnabled: false,
      seasonLengthCycles: 1,
    },
    terrain: {
      width: 24,
      depth: 24,
      height: 16,
      seed: 3201,
      waterLevel: 0.3,
      biomes: ["plains"],
    },
    resources: {
      scarcityEnabled: false,
      resources: [
        {
          type: "food",
          spawnDensity: 10,
          regenerationRateTicks: 100,
          depletionEnabled: false,
          qualityVariance: false,
          depthBias: 0,
        },
      ],
    },
    agents: {
      count: 3,
      speciesId: "human",
      startingArea: { centerX: 12, centerZ: 12, radius: 3 },
    },
    species: [
      {
        id: "human",
        name: "Human",
        cognitiveTier: "full_llm",
        senseProfile: { sight: 1, sound: 1, smell: 1, empath: 1 },
        emotionalFieldEnabled: true,
        socialCapacity: "full",
        canLearnLanguage: true,
        canBedomesticated: false,
        baseStats: {
          maxHealth: 100,
          speed: 1,
          strength: 1,
          metabolism: 1,
          reachRange: 1,
          lifespanTicks: 10000,
          reproductionAge: 0,
          gestationTicks: 0,
        },
        muscleStatRanges: {
          strength: [0.3, 0.8],
          speed: [0.3, 0.8],
          endurance: [0.3, 0.8],
        },
        dnaTraits: [],
        threatLevel: 0.2,
        ecologicalRole: "neutral",
        sleepConfig: {
          mode: "natural_sleep",
          fatigueEnabled: true,
          fatigueRate: 0.05,
          recoveryRate: 0.1,
          minRestDuration: 10,
          maxWakeDuration: 100,
          cognitivePenaltyNoSleep: 0.1,
          emotionalPenaltyNoSleep: 0.1,
          healthPenaltyNoSleep: 0.1,
          consolidationDuringSleep: true,
          consolidationWhileAwake: false,
          consolidationIntervalTicks: 0,
          dreamsEnabled: false,
          nightmaresEnabled: false,
          sleepSchedule: "individual",
        },
        memoryConfig: {},
        survivalDriveWeight: 0.8,
        circadianSensitivity: 0.8,
      },
    ],
    language: {
      startingMode: "none",
      maxEmergenceStage: 1,
      lexiconConstrainsThought: true,
      dialectDivergenceEnabled: false,
      pidginFormationEnabled: false,
      writingDiscoveryEnabled: false,
      confidenceThresholdForLexicon: 0.7,
      minimumAgentsForConsensus: 1,
    },
    sleep: {
      mode: "natural_sleep",
      fatigueEnabled: true,
      fatigueRate: 0.05,
      recoveryRate: 0.1,
      minRestDuration: 10,
      maxWakeDuration: 100,
      cognitivePenaltyNoSleep: 0.1,
      emotionalPenaltyNoSleep: 0.1,
      healthPenaltyNoSleep: 0.1,
      consolidationDuringSleep: true,
      consolidationWhileAwake: false,
      consolidationIntervalTicks: 0,
      dreamsEnabled: false,
      nightmaresEnabled: false,
      sleepSchedule: "individual",
    },
    dreams: {
      consolidationEnabled: false,
      propheticEnabled: false,
      traumaProcessingEnabled: false,
      chaosEnabled: false,
      consolidationProbability: 0,
      propheticProbability: 0,
      traumaProbability: 0,
      chaosProbability: 0,
      nightmareThreshold: 1,
    },
    memory: {
      episodicDecayRate: 0.5,
      episodicCapacity: 100,
      patternSeparation: true,
      semanticDecayRate: 0.1,
      semanticCapacity: 100,
      consistencyThreshold: 0.3,
      catastrophicInterferenceEnabled: false,
      neSignalEnabled: false,
      neDecayRate: 0.1,
      neLockDuration: 0,
      consolidationPassesPerSleep: 1,
      traumaDistortionEnabled: false,
      rehearsalResetsDecay: true,
      motivatedForgettingEnabled: false,
      suppressionDecayRate: 0.1,
      contextualForgettingEnabled: false,
      inheritanceEnabled: false,
      inheritableFraction: 0,
    },
    freeWill: {
      enabled: true,
      willScoreEnabled: true,
      identityCoherenceWeight: 0.4,
      memoryDepthWeight: 0.3,
      dreamIntegrationWeight: 0.3,
      resistanceEnabled: true,
      selfDeterminationEnabled: true,
      selfNarrativeEnabled: true,
      simulationAwarenessEnabled: false,
      awarenessThreshold: 1,
      survivalDriveWeight: 0.8,
    },
    perception: {
      physicsLimitsEnabled: true,
      emotionalFieldEnabled: true,
      emotionalFieldSuppressible: true,
      feelingResidueEnabled: true,
      residueDecayRate: 0.1,
      qualiaFidelity: "standard",
      attentionFilterEnabled: true,
      attentionCapacity: 3,
      attentionWeights: {
        relationshipStrength: 0.2,
        emotionalFieldIntensity: 0.2,
        movementVelocity: 0.2,
        novelty: 0.4,
      },
    },
    elements: {
      fire: { enabled: false, spreadRateTicksPerVoxel: 3, selfExtinguishTicks: 10 },
      water: { enabled: true, flowRateTicksPerVoxel: 2 },
      wind: { enabled: false, directionChangeProbability: 0, maxSpeed: 0 },
    },
    semanticMasking: {
      enabled: false,
      sensorLabelMap: {},
      rotatePeriodically: false,
      rotationIntervalTicks: 1000,
      qualiaUsesRealLabels: true,
    },
    research: {
      tripleBaselineEnabled: false,
      hypothesisTrackingEnabled: false,
      paramSweepEnabled: false,
      findingsJournalEnabled: false,
      causalMiningEnabled: false,
      tippingPointEnabled: false,
      emergenceDetectionEnabled: false,
    },
    time: {
      elasticHeartbeat: false,
      maxHeartbeatWaitMs: 1000,
      tickDurationMs: 100,
      multiWorkerEnabled: false,
    },
  };
}

function bootstrapSignature(config: WorldConfig): string {
  const registry = new SpeciesRegistry();
  registry.loadAll();
  const boot = bootstrapSimulation(config, {
    runId: `replay-${randomUUID()}`,
    branchId: "main",
    eventBus: new EventBus(),
    clock: new SimClock(),
    gateway: {} as LLMGateway,
    speciesRegistry: registry,
    database: db,
    runSupervisor: new RunSupervisor(),
  });

  const agentPart = boot.agents
    .map((agent) => `${agent.id}:${agent.position.x},${agent.position.y},${agent.position.z}`)
    .join("|");

  const samples: string[] = [];
  const points: Array<[number, number]> = [
    [2, 2],
    [7, 11],
    [12, 4],
    [17, 15],
  ];

  for (const [x, z] of points) {
    let top = "none";
    for (let y = boot.world.height - 1; y >= 0; y--) {
      const voxel = boot.world.get(x, y, z);
      if (!voxel || voxel.material === "air") continue;
      top = `${y}:${voxel.material}`;
      break;
    }
    samples.push(`${x},${z}=${top}`);
  }

  return `${agentPart}#${samples.join("|")}`;
}

test("replay equivalence: bootstrap signature is deterministic for same config and seed", () => {
  const config = testConfig();
  const sigA = bootstrapSignature(config);
  const sigB = bootstrapSignature(config);

  expect(sigA).toBe(sigB);
});
