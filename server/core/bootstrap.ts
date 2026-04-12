import type { AgentState, BodyMap, SpeciesConfig, WorldConfig } from "../../shared/types";
import { System2 } from "../agents/system2";
import type { LLMGateway } from "../llm/gateway";
import type { Database } from "../persistence/database";
import type { SpeciesRegistry } from "../species/registry";
import { PhysicsEngine } from "../world/physics-engine";
import { TerrainGenerator } from "../world/terrain-generator";
import type { VoxelGrid } from "../world/voxel-grid";
import { BranchManager } from "./branch-manager";
import type { EventBus } from "./event-bus";
import { Orchestrator } from "./orchestrator";
import { RunManager } from "./run-manager";
import type { RunSupervisor } from "./run-supervisor";
import { RunStateStore } from "./run-state-store";
import type { SimClock } from "./sim-clock";
import { WorldConfigManager } from "./world-config-manager";

type BootstrapDependencies = {
  eventBus: EventBus;
  clock: SimClock;
  gateway: LLMGateway;
  speciesRegistry: SpeciesRegistry;
  database: Database;
  runSupervisor: RunSupervisor;
};

type BootstrapResult = {
  runId: string;
  branchId: string;
  config: WorldConfig;
  world: VoxelGrid;
  orchestrator: Orchestrator;
  agents: AgentState[];
};

function createBodyMap(labelPrefix: string): BodyMap {
  return {
    head: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} head` },
    torso: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} torso` },
    leftArm: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} left arm` },
    rightArm: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} right arm` },
    leftLeg: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} left leg` },
    rightLeg: { pain: 0, temperature: 15, damage: 0, label: `${labelPrefix} right leg` },
  };
}

function midpoint([min, max]: [number, number]): number {
  return (min + max) / 2;
}

function createAgent(species: SpeciesConfig, index: number, branchId: string): AgentState {
  const labelPrefix = species.name.toLowerCase();

  return {
    id: `${species.id}-${index + 1}`,
    speciesId: species.id,
    name: `${species.name} ${index + 1}`,
    generation: 1,
    body: {
      hunger: 0,
      thirst: 0,
      fatigue: 0,
      health: species.baseStats.maxHealth,
      bodyMap: createBodyMap(labelPrefix),
      coreTemperature: 15,
      arousal: 0,
      valence: 0,
      cycleHormone: 0,
      circadianPhase: 0,
      immediateReaction: "NONE",
      integrityDrive: 0,
    },
    position: { x: index % 8, y: 8, z: Math.floor(index / 8) },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: {
      strength: midpoint(species.muscleStatRanges.strength),
      speed: midpoint(species.muscleStatRanges.speed),
      endurance: midpoint(species.muscleStatRanges.endurance),
    },
    currentAction: "IDLE",
    pendingSystem2: false,
    innerMonologue: "",
    selfNarrative: `You awaken as ${species.name.toLowerCase()} life in ${branchId}.`,
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

function selectSpecies(config: WorldConfig, speciesRegistry: SpeciesRegistry): SpeciesConfig[] {
  if (config.species && config.species.length > 0) {
    return config.species;
  }

  const loaded = speciesRegistry.getAll();
  if (loaded.length === 0) {
    throw new Error("No species definitions available for bootstrap.");
  }

  const preferredOrder = ["human", "wolf", "deer"];
  const ordered = preferredOrder
    .map((id) => loaded.find((species) => species.id === id))
    .filter((species): species is SpeciesConfig => Boolean(species));

  return ordered.length > 0 ? ordered : loaded;
}

export function bootstrapSimulation(
  template: WorldConfig,
  deps: BootstrapDependencies,
): BootstrapResult {
  const configHash = WorldConfigManager.hashWorldConfig(template).slice(0, 12);
  const runId = `run-${template.meta.seed}-${configHash}`;
  const branchId = "main";

  const existingRun = RunManager.getRun(runId);
  if (!existingRun) {
    RunManager.createRun(runId, template.meta.name, 0, template);
  }
  WorldConfigManager.create(template, runId, deps.database);
  BranchManager.createBranch(branchId, "main", 0);
  const config = WorldConfigManager.load(runId, branchId, 0, deps.database);
  const world = TerrainGenerator.generate(config.terrain);
  const physics = new PhysicsEngine(config.physics);
  const system2 = new System2(deps.gateway, deps.speciesRegistry);

  const orchestrator = new Orchestrator(
    runId,
    branchId,
    config,
    world,
    deps.clock,
    deps.eventBus,
    physics,
    system2,
  );
  deps.runSupervisor.registerRuntime({
    runId,
    branchId,
    clock: deps.clock,
    eventBus: deps.eventBus,
    orchestrator,
    worldConfig: config,
    world,
    agents: [],
    status: "created",
  });
  RunStateStore.record(runId, "created", 0);

  const speciesPool = selectSpecies(config, deps.speciesRegistry);
  const agents = Array.from({ length: config.agents.initialCount }, (_, index) =>
    createAgent(speciesPool[index % speciesPool.length] as SpeciesConfig, index, branchId),
  );

  for (const agent of agents) {
    orchestrator.addAgent(agent);
  }

  const runtime = deps.runSupervisor.getRuntime(runId);
  if (runtime) {
    runtime.agents = agents;
    runtime.status = "created";
  }

  return { runId, branchId, config, world, orchestrator, agents };
}
