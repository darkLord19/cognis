import {
  DECAY_ENGINE_INTERVAL_TICKS,
  SALIENCE_ENCODE_THRESHOLD,
  SNAPSHOT_INTERVAL_TICKS,
} from "../../shared/constants";
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
import { SemanticStore } from "../memory/semantic-store";
import { EmotionalField } from "../perception/emotional-field";
import { FeelingResidueSystem } from "../perception/feeling-residue";
import { SenseComputer } from "../perception/sense-computer";
import { MerkleLogger } from "../persistence/merkle-logger";
import { BehaviorTree } from "../species/behavior-tree";
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
  public agents: AgentState[] = [];
  public getAgents(): AgentState[] {
    return this.agents;
  }
  private spatialIndex: SpatialIndex = new SpatialIndex();
  private techTree: TechTree;
  private system2: System2;
  private vocalActuations: VocalActuation[] = [];

  constructor(
    private runId: string,
    private branchId: string,
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

  private usesBehaviorTree(agent: AgentState): boolean {
    return agent.speciesId === "wolf" || agent.speciesId === "deer";
  }

  private applyDecision(
    agent: AgentState,
    decision: { type: string; position: AgentState["position"] | undefined },
  ): boolean {
    agent.currentAction = decision.type as AgentState["currentAction"];

    if (decision.type === "MOVE" && decision.position) {
      agent.position = { ...decision.position };
      return true;
    }

    if (decision.type === "MOVE") {
      const goal = typeof agent.currentAction === "string" ? agent.currentAction : "MOVE";
      const deltaX = goal === "MOVE" && agent.speciesId === "deer" ? -1 : 1;
      agent.position = {
        x: agent.position.x + deltaX,
        y: agent.position.y,
        z: agent.position.z,
      };
      return true;
    }

    return false;
  }

  public async tick(): Promise<void> {
    const tick = this.clock.getTick();
    let positionsChanged = false;

    let totalDecisions = 0;
    let _vocalizations = 0;

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
      // 4a. System1
      const bodyDelta = System1.tick(agent, circadianState, this.config);
      const oldBody = { ...agent.body };
      Object.assign(agent.body, bodyDelta);

      // Log significant body state changes to MerkleLogger
      if (bodyDelta.integrityDrive !== undefined) {
        MerkleLogger.log(
          tick,
          this.branchId,
          agent.id,
          "System1",
          "integrityDrive",
          String(oldBody.integrityDrive || 0),
          String(bodyDelta.integrityDrive),
          null,
        );
      }

      // 4j. Check immediate reactions (RECOIL, FLEE, COLLAPSE)
      const reaction = System1.checkImmediateReaction(agent);
      if (reaction) {
        this.eventBus.emit({
          event_id: crypto.randomUUID(),
          branch_id: this.branchId,
          run_id: this.runId,
          tick,
          type: EventType.DECISION_MADE,
          agent_id: agent.id,
          payload: { reaction: reaction.type, intensity: reaction.intensity },
        });
        totalDecisions++;
        // Apply immediate reaction — skip System2 for this tick
        if (reaction.type === "COLLAPSE") {
          agent.body.fatigue = 1.0;
          continue; // Skip rest of agent pipeline
        }
      }

      // 4b. Sense
      const rawPercept = SenseComputer.computePerception(
        agent,
        this.world,
        this.spatialIndex,
        this.config.perception,
        circadianState,
        this.vocalActuations,
      );

      // 4c. Attention
      const filteredPercept = AttentionFilter.filter(rawPercept, agent, this.config.perception);

      // 4d. Emotional Field
      const emotionalDetections = EmotionalField.detectFields(
        agent,
        filteredPercept.primaryAttention,
        tick,
        this.branchId,
      );

      // 4e. Mood Tint
      const moodTint = FeelingResidueSystem.getMoodTint(agent.feelingResidues);

      // 4f. Qualia
      const qualiaText = QualiaProcessor.qualiaFor(
        agent,
        filteredPercept,
        emotionalDetections,
        moodTint,
        circadianState,
        this.config,
      );

      // 4g. Episodic retrieval (for System2 context)
      const _recentMemories = EpisodicStore.retrieve(agent.id, this.branchId, 5);

      // 4h. Salience
      const event: SimEvent = {
        event_id: crypto.randomUUID(),
        branch_id: this.branchId,
        run_id: this.runId,
        tick,
        type: EventType.TICK,
        payload: { qualia: qualiaText },
      };
      const salience = SalienceGate.computeSalience(event, agent, this.config.memory);

      // 4i. System2 / behaviour tree
      if (this.usesBehaviorTree(agent)) {
        const decision = BehaviorTree.tick(agent);
        if (decision.type !== "IDLE") {
          positionsChanged =
            this.applyDecision(agent, {
              type: decision.type,
              position: decision.position,
            }) || positionsChanged;
          this.eventBus.emit({
            event_id: crypto.randomUUID(),
            branch_id: this.branchId,
            run_id: this.runId,
            tick,
            type: EventType.DECISION_MADE,
            agent_id: agent.id,
            payload: { decision },
          });
          totalDecisions++;
        }
      } else if (
        this.system2.shouldFire(
          agent,
          {
            ...bodyDelta,
            previousIntegrityDrive: oldBody.integrityDrive ?? 0,
            currentIntegrityDrive: agent.body.integrityDrive ?? 0,
          } as Record<string, unknown>,
          filteredPercept,
          this.config,
        )
      ) {
        this.clock.registerPendingMind();
        totalDecisions++;
        pendingSystem2.push(
          this.system2
            .think(agent, qualiaText, filteredPercept, this.config, tick, this.branchId)
            .then((output) => {
              this.clock.resolvePendingMind();

              // 4l. Apply decision / update position
              if (output.decision && output.decision.type !== "IDLE") {
                positionsChanged =
                  this.applyDecision(agent, {
                    type: output.decision.type,
                    position: output.decision.position,
                  }) || positionsChanged;
                this.eventBus.emit({
                  event_id: crypto.randomUUID(),
                  branch_id: this.branchId,
                  run_id: this.runId,
                  tick,
                  type: EventType.DECISION_MADE,
                  agent_id: agent.id,
                  payload: { decision: output.decision },
                });
                totalDecisions++;
              }

              // Update self-narrative
              if (output.selfNarrativeUpdate) {
                agent.selfNarrative += `\n${output.selfNarrativeUpdate}`;
              }

              // Store theory of mind entries
              if (output.theoriesAboutOthers) {
                for (const tom of output.theoriesAboutOthers) {
                  agent.mentalModels[tom.targetAgentId] = {
                    inferred: true,
                    estimatedValence: tom.estimatedValence,
                    estimatedArousal: tom.estimatedArousal,
                    ...(tom.estimatedIntent !== undefined
                      ? { estimatedIntent: tom.estimatedIntent }
                      : {}),
                    confidence: tom.confidence,
                    lastUpdatedTick: tick,
                  };
                }
              }
            }),
        );
      }

      // 4m. Episodic encode
      if (salience > SALIENCE_ENCODE_THRESHOLD) {
        EpisodicStore.encode(
          agent.id,
          this.branchId,
          qualiaText,
          event,
          salience,
          this.config.memory,
        );
      }

      // 4n. Death observation tracking
      for (const other of filteredPercept.primaryAttention) {
        // Check for dead agents (no emotional field, low body temp, no movement)
        if (other.body.valence === 0 && other.body.arousal === 0 && other.body.fatigue >= 1.0) {
          SemanticStore.trackDeathObservation(agent.id, this.branchId, "observed_agent_stillness");
          SemanticStore.trackDeathObservation(
            agent.id,
            this.branchId,
            "observed_absent_emotional_field",
          );
          // Check body temperature for coldness
          const headTemp = other.body.bodyMap?.head?.temperature ?? 15;
          if (headTemp < 10) {
            SemanticStore.trackDeathObservation(agent.id, this.branchId, "observed_cold_body");
          }
        }
      }

      // 4o. Feeling residue tick
      FeelingResidueSystem.tickResidues(
        agent.feelingResidues,
        this.config.perception.residueDecayRate,
      );

      // 4p. Vocal actuation
      const vocal = System1.checkVocalActuation(agent, tick);
      if (vocal) {
        this.vocalActuations.push(vocal);
      }
    }

    if (positionsChanged) {
      this.spatialIndex.rebuildIndex(this.agents);
    }

    // 5. Language
    for (const va of this.vocalActuations) {
      _vocalizations++;
      const emitter = this.agents.find((a) => a.id === va.emitterId);
      const emitterPos = emitter?.position ?? { x: 0, y: 0, z: 0 };
      const listeners = this.spatialIndex.getAgentsInRadius(emitterPos, 50);
      const nearbyVoxels = emitter
        ? SenseComputer.computePerception(
            emitter,
            this.world,
            this.spatialIndex,
            this.config.perception,
            circadianState,
            [],
          ).nearbyVoxels
        : [];
      LanguageEmergence.processVocalActuation(
        va,
        listeners,
        nearbyVoxels,
        this.branchId,
        this.eventBus,
      );
    }
    this.vocalActuations = [];

    // 6. TechTree check discoveries
    for (const agent of this.agents) {
      this.techTree.checkDeathConceptDiscovery(agent);
    }

    // 10. Delta stream
    DeltaStream.flushTick(this.branchId, tick, this.world.getDirtyVoxels());
    this.world.clearDirty();

    // 11. Decay
    if (tick % DECAY_ENGINE_INTERVAL_TICKS === 0) {
      DecayEngine.tickAll(this.agents, this.branchId, this.config.memory, tick);
    }

    // 13. WebSocket broadcast — handled via EventBus (events are automatically dispatched)

    // 14. Snapshot agents periodically
    if (tick % SNAPSHOT_INTERVAL_TICKS === 0) {
      for (const agent of this.agents) {
        MerkleLogger.log(
          tick,
          this.branchId,
          agent.id,
          "Snapshot",
          "state",
          null,
          JSON.stringify({
            hunger: agent.body.hunger,
            thirst: agent.body.thirst,
            fatigue: agent.body.fatigue,
            integrityDrive: agent.body.integrityDrive,
          }),
          null,
        );
      }
    }

    console.log(`[tick ${tick}] agents: ${this.agents.length}, system2_calls: ${totalDecisions}`);

    // Wait for async system2 if desired, but PRD says non-blocking tick.
    // However, for tests we might want to wait.
  }
}
