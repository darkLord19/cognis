import type { SimEvent } from "../../shared/events";
import { EventType } from "../../shared/events";
import type { AgentState, VocalActuation, WorldConfig } from "../../shared/types";
import { AttentionFilter } from "../agents/attention-filter";
import { QualiaProcessor } from "../agents/qualia-processor";
import { System1 } from "../agents/system1";
import type { System2 } from "../agents/system2";
import { LanguageEmergence } from "../language/emergence";
import { DecayEngine } from "../memory/decay-engine";
import { EpisodicStore } from "../memory/episodic-store";
import { SalienceGate } from "../memory/salience-gate";
import { EmotionalField } from "../perception/emotional-field";
import { FeelingResidueSystem } from "../perception/feeling-residue";
import { SenseComputer } from "../perception/sense-computer";
import { CircadianEngine } from "../world/circadian-engine";
import { DeltaStream } from "../world/delta-stream";
import { ElementEngine } from "../world/element-engine";
import type { PhysicsEngine } from "../world/physics-engine";
import { SpatialIndex } from "../world/spatial-index";
import { TechTree } from "../world/tech-tree";
import type { VoxelGrid } from "../world/voxel-grid";
import type { EventBus } from "./event-bus";
import type { SimClock } from "./sim-clock";

export class Orchestrator {
  private agents: AgentState[] = [];
  private spatialIndex: SpatialIndex = new SpatialIndex();
  private techTree: TechTree;
  private system2: System2;
  private vocalActuations: VocalActuation[] = [];

  constructor(
    private config: WorldConfig,
    private world: VoxelGrid,
    private clock: SimClock,
    private eventBus: EventBus,
    private physics: PhysicsEngine,
    system2: System2,
  ) {
    this.techTree = new TechTree(eventBus);
    this.system2 = system2;
  }

  public addAgent(agent: AgentState): void {
    this.agents.push(agent);
    this.spatialIndex.rebuildIndex(this.agents);
  }

  public async tick(): Promise<void> {
    const tick = this.clock.getTick();
    const branchId = "main";

    // 1. Circadian
    const circadianState = CircadianEngine.tick(tick, this.world, this.config.circadian);

    // 2. Elements
    const elements = new ElementEngine(this.physics);
    elements.tick(this.world);

    // 3. Physics
    for (const agent of this.agents) {
      const gravityDelta = this.physics.applyGravityToAgent(agent, this.world);
      Object.assign(agent.body, gravityDelta);
    }

    // 4. Agent pipeline
    const pendingSystem2: Promise<void>[] = [];

    for (const agent of this.agents) {
      // a. System1
      const bodyDelta = System1.tick(agent, circadianState, this.config);
      Object.assign(agent.body, bodyDelta);

      // b. Sense
      const rawPercept = SenseComputer.computePerception(
        agent,
        this.world,
        this.spatialIndex,
        this.config.perception,
        circadianState,
        this.vocalActuations,
      );

      // c. Attention
      const filteredPercept = AttentionFilter.filter(rawPercept, agent, this.config.perception);

      // d. Emotional Field
      const emotionalDetections = EmotionalField.detectFields(
        agent,
        filteredPercept.primaryAttention,
        tick,
        branchId,
      );

      // e. Mood Tint
      const moodTint = FeelingResidueSystem.getMoodTint(agent.feelingResidues);

      // f. Qualia
      const qualiaText = QualiaProcessor.qualiaFor(
        agent,
        filteredPercept,
        emotionalDetections,
        moodTint,
        circadianState,
        this.config,
      );

      // h. Salience
      const event: SimEvent = {
        event_id: crypto.randomUUID(),
        branch_id: branchId,
        run_id: "default",
        tick,
        type: EventType.TICK,
        payload: { qualia: qualiaText },
      };
      const salience = SalienceGate.computeSalience(event, agent, this.config.memory);

      // i. System2
      if (
        this.system2.shouldFire(
          agent,
          bodyDelta as Record<string, unknown>,
          filteredPercept,
          this.config,
        )
      ) {
        this.clock.registerPendingMind();
        pendingSystem2.push(
          this.system2
            .think(agent, qualiaText, filteredPercept, this.config, tick, branchId)
            .then((_output) => {
              this.clock.resolvePendingMind();
            }),
        );
      }

      // m. Episodic encode
      if (salience > 0.5) {
        EpisodicStore.encode(agent.id, branchId, qualiaText, event, salience, this.config.memory);
      }

      // p. Vocal actuation
      const vocal = System1.checkVocalActuation(agent, tick);
      if (vocal) {
        this.vocalActuations.push(vocal);
      }
    }

    // 5. Language
    for (const va of this.vocalActuations) {
      const listeners = this.spatialIndex.getAgentsInRadius({ x: 0, y: 0, z: 0 }, 50);
      LanguageEmergence.processVocalActuation(va, listeners, [], branchId, this.eventBus);
    }
    this.vocalActuations = [];

    // 10. Delta stream
    DeltaStream.flushTick(branchId, tick, this.world.getDirtyVoxels());
    this.world.clearDirty();

    // 11. Decay
    if (tick % 10 === 0) {
      DecayEngine.tickAll(this.agents, branchId, this.config.memory, tick);
    }

    // Wait for async system2 if desired, but PRD says non-blocking tick.
    // However, for tests we might want to wait.
  }
}
