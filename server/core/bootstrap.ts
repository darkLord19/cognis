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
import type { MultiWorkerRuntime } from "./multi-worker-runtime";
import { Orchestrator } from "./orchestrator";
import { RunManager } from "./run-manager";
import type { RunSupervisor } from "./run-supervisor";
import type { SimClock } from "./sim-clock";
import { WorldConfigManager } from "./world-config-manager";

type BootstrapDependencies = {
  runId?: string;
  branchId?: string;
  eventBus: EventBus;
  clock: SimClock;
  gateway: LLMGateway;
  speciesRegistry: SpeciesRegistry;
  database: Database;
  runSupervisor: RunSupervisor;
  multiWorkerRuntime?: MultiWorkerRuntime;
};

type BootstrapResult = {
  runId: string;
  branchId: string;
  config: WorldConfig;
  world: VoxelGrid;
  orchestrator: Orchestrator;
  agents: AgentState[];
};

function createBodyMap(labelPrefix: string, baselineTemperature: number): BodyMap {
  return {
    head: { pain: 0, temperature: baselineTemperature, damage: 0, label: `${labelPrefix} head` },
    torso: {
      pain: 0,
      temperature: baselineTemperature,
      damage: 0,
      label: `${labelPrefix} torso`,
    },
    leftArm: {
      pain: 0,
      temperature: baselineTemperature,
      damage: 0,
      label: `${labelPrefix} left arm`,
    },
    rightArm: {
      pain: 0,
      temperature: baselineTemperature,
      damage: 0,
      label: `${labelPrefix} right arm`,
    },
    leftLeg: {
      pain: 0,
      temperature: baselineTemperature,
      damage: 0,
      label: `${labelPrefix} left leg`,
    },
    rightLeg: {
      pain: 0,
      temperature: baselineTemperature,
      damage: 0,
      label: `${labelPrefix} right leg`,
    },
  };
}

function midpoint([min, max]: [number, number]): number {
  return (min + max) / 2;
}

function createAgent(
  species: SpeciesConfig,
  index: number,
  branchId: string,
  config: WorldConfig,
): AgentState {
  const labelPrefix = species.name.toLowerCase();
  const baselineTemperature = config.physics.temperatureBaseline ?? 15;

  const spawnArea = config.agents.startingArea;
  const fallbackX = index % 8;
  const fallbackZ = Math.floor(index / 8);
  const spawnX = spawnArea
    ? Math.max(
        0,
        Math.min(
          config.terrain.width - 1,
          Math.round(
            spawnArea.centerX +
              Math.cos(index * 1.618) * Math.min(spawnArea.radius, 3 + (index % 3)),
          ),
        ),
      )
    : fallbackX;
  const spawnZ = spawnArea
    ? Math.max(
        0,
        Math.min(
          config.terrain.depth - 1,
          Math.round(
            spawnArea.centerZ +
              Math.sin(index * 1.618) * Math.min(spawnArea.radius, 3 + (index % 3)),
          ),
        ),
      )
    : fallbackZ;

  return {
    id: `${species.id}-${index + 1}`,
    speciesId: species.id,
    name: `${species.name} ${index + 1}`,
    generation: 1,
    body: {
      energy: 0.7,
      hydration: 0.8,
      fatigue: 0.1,
      health: 1,
      toxinLoad: 0,
      oxygenation: 1,
      inflammation: 0,
      painLoad: 0,
      bodyMap: createBodyMap(labelPrefix, baselineTemperature),
      coreTemperature: baselineTemperature,
      arousal: 0.2,
      valence: 0.1,
      cycleHormone: 0.3,
      circadianPhase: 0.5,
      immediateReaction: "NONE",
      integrityDrive: 0,
    },
    position: { x: spawnX, y: Math.min(8, config.terrain.height - 1), z: spawnZ },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: {
      strength: midpoint(species.muscleStatRanges.strength),
      speed: midpoint(species.muscleStatRanges.speed),
      endurance: midpoint(species.muscleStatRanges.endurance),
    },
    currentAction: { type: "REST" },
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
    const direct = config.species.filter((entry): entry is SpeciesConfig => "id" in entry);
    if (direct.length > 0) {
      return direct;
    }

    const resolved = config.species
      .map((entry) => {
        const ref = (entry as { $ref?: string }).$ref;
        if (!ref) return null;
        const match = ref.match(/\/([^/]+)\.json$/);
        const speciesId = match?.[1];
        return speciesId ? (speciesRegistry.get(speciesId) ?? null) : null;
      })
      .filter((entry): entry is SpeciesConfig => Boolean(entry));
    if (resolved.length > 0) {
      return resolved;
    }
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
  const runId = deps.runId ?? `run-${template.meta.seed}-${configHash}`;
  const branchId = deps.branchId ?? "main";

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
    deps.multiWorkerRuntime,
  );
  deps.runSupervisor.registerRuntime({
    runId,
    branchId,
    clock: deps.clock,
    eventBus: deps.eventBus,
    orchestrator,
    ...(deps.multiWorkerRuntime ? { workerRuntime: deps.multiWorkerRuntime } : {}),
    worldConfig: config,
    world,
    agents: [],
    status: "created",
  });
  const speciesPool = selectSpecies(config, deps.speciesRegistry);
  const requestedCount = config.agents.count ?? config.agents.initialCount ?? 0;
  const agents = Array.from({ length: requestedCount }, (_, index) =>
    createAgent(speciesPool[index % speciesPool.length] as SpeciesConfig, index, branchId, config),
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
