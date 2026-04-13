import {
  DECAY_ENGINE_INTERVAL_TICKS,
  SALIENCE_ENCODE_THRESHOLD,
  SNAPSHOT_INTERVAL_TICKS,
  URGENCY_THRESHOLD,
} from "../../shared/constants";
import type { SimEvent } from "../../shared/events";
import { EventType } from "../../shared/events";
import type { AgentState, VocalActuation, WorldConfig } from "../../shared/types";
import { AttentionFilter } from "../agents/attention-filter";
import { QualiaProcessor } from "../agents/qualia-processor";
import { System1 } from "../agents/system1";
import type { System2 } from "../agents/system2";
import { EmergenceDetector } from "../analysis/emergence-detector";
import { LanguageEmergence } from "../language/emergence";
import { VocalActuationBroadcaster } from "../language/vocal-actuation-broadcaster";
import { DecayEngine } from "../memory/decay-engine";
import { EpisodicStore } from "../memory/episodic-store";
import { SalienceGate } from "../memory/salience-gate";
import { SemanticStore } from "../memory/semantic-store";
import { EmotionalField } from "../perception/emotional-field";
import { FeelingResidueSystem } from "../perception/feeling-residue";
import { SenseComputer } from "../perception/sense-computer";
import { MerkleLogger } from "../persistence/merkle-logger";
import { CircadianEngine } from "../world/circadian-engine";
import { DeltaStream } from "../world/delta-stream";
import { ElementEngine } from "../world/element-engine";
import type { PhysicsEngine } from "../world/physics-engine";
import { SpatialIndex } from "../world/spatial-index";
import { TechTree } from "../world/tech-tree";
import type { VoxelGrid } from "../world/voxel-grid";
import type { EventBus } from "./event-bus";
import type { MultiWorkerRuntime } from "./multi-worker-runtime";
import type { SimClock } from "./sim-clock";

function hashQualiaPacket(agentId: string, tick: number, qualiaText: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${agentId}|${tick}|${qualiaText}`);
  return hasher.digest("hex");
}

export class Orchestrator {
  public agents: AgentState[] = [];
  public getAgents(): AgentState[] {
    return this.agents;
  }
  private spatialIndex: SpatialIndex = new SpatialIndex();
  private techTree: TechTree;
  private system2: System2;
  private vocalActuations: VocalActuation[] = [];
  private recentDecisions = new Map<string, string[]>();
  private emergenceDetector = new EmergenceDetector();
  private recentEventsWindow: SimEvent[] = [];

  constructor(
    private runId: string,
    private branchId: string,
    private config: WorldConfig,
    private world: VoxelGrid,
    private clock: SimClock,
    private eventBus: EventBus,
    private physics: PhysicsEngine,
    system2: System2,
    private multiWorkerRuntime?: MultiWorkerRuntime,
  ) {
    this.techTree = new TechTree(eventBus);
    this.system2 = system2;
  }

  public addAgent(agent: AgentState): void {
    this.agents.push(agent);
    this.spatialIndex.rebuildIndex(this.agents);
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

  private checkDecisionLoop(
    agentId: string,
    decision: { type: string; params?: unknown },
  ): boolean {
    const history = this.recentDecisions.get(agentId) ?? [];
    const decisionStr = JSON.stringify(decision);
    history.push(decisionStr);
    if (history.length > 5) history.shift();
    this.recentDecisions.set(agentId, history);

    if (history.length === 5 && history.every((entry) => entry === decisionStr)) {
      console.warn(`[LOOP DETECTED] Agent ${agentId} looping on: ${decisionStr}`);
      return true;
    }

    return false;
  }

  private breakDecisionLoop(): { type: "MOVE"; params: { goal: string; jitter: number } } {
    const options = ["wander", "patrol", "probe"];
    const goal = options[Math.floor(Math.random() * options.length)] ?? "wander";
    return {
      type: "MOVE",
      params: { goal, jitter: Number(Math.random().toFixed(3)) },
    };
  }

  private emitAndTrack(event: SimEvent): void {
    this.recentEventsWindow.push(event);
    if (this.recentEventsWindow.length > 500) {
      this.recentEventsWindow.shift();
    }
    this.eventBus.emit(event);
  }

  public async tick(): Promise<void> {
    const tick = this.clock.getTick();
    this.multiWorkerRuntime?.syncAgents(this.agents);

    let positionsChanged = false;
    const deadAgentIds: string[] = [];

    let totalDecisions = 0;
    let _vocalizations = 0;

    // 1. Circadian
    const circadianState = CircadianEngine.tick(tick, this.world, this.config.circadian);

    // 2. Elements
    const elements = new ElementEngine(this.physics);
    elements.tick(this.world, tick);

    // 3. Physics
    for (const agent of this.agents) {
      const gravityDelta = this.physics.applyGravityToAgent(agent, this.world);
      Object.assign(agent.body, gravityDelta);
    }

    // 4. Agent pipeline
    const pendingSystem2: Promise<void>[] = [];

    for (const agent of this.agents) {
      // 4a. System1
      const localX = Math.floor(agent.position.x);
      const localY = Math.floor(agent.position.y);
      const localZ = Math.floor(agent.position.z);
      const localVoxel = this.world.get(localX, localY, localZ);
      const biomassAvailable =
        localVoxel?.material === "biomass" ? (localVoxel.metadata?.resourceQuality ?? 1) : 0;

      const bodyDelta = System1.tick(agent, circadianState, this.config, {
        localMaterial: localVoxel?.material,
        biomassAvailable,
      });
      const { shouldDie, biomassConsumed = 0, ...bodyStateDelta } = bodyDelta;
      const oldBody = { ...agent.body };
      Object.assign(agent.body, bodyStateDelta);

      if (biomassConsumed > 0 && localVoxel?.material === "biomass") {
        const currentQuality = localVoxel.metadata?.resourceQuality ?? 1;
        const nextQuality = Math.max(0, currentQuality - biomassConsumed);

        if (nextQuality === 0) {
          this.world.set(localX, localY, localZ, {
            ...localVoxel,
            type: 2,
            material: "dirt",
            metadata: {
              ...(localVoxel.metadata ?? {}),
              resourceQuality: 0,
            },
          });
          this.emitAndTrack({
            event_id: crypto.randomUUID(),
            branch_id: this.branchId,
            run_id: this.runId,
            tick,
            type: EventType.RESOURCE_DEPLETED,
            agent_id: agent.id,
            payload: {
              material: "biomass",
              position: { x: localX, y: localY, z: localZ },
              consumed: biomassConsumed,
            },
          });
        } else {
          this.world.set(localX, localY, localZ, {
            ...localVoxel,
            metadata: {
              ...(localVoxel.metadata ?? {}),
              resourceQuality: nextQuality,
            },
          });
        }
      }

      if (shouldDie) {
        deadAgentIds.push(agent.id);
        continue;
      }

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

      const urgencyOverride =
        (agent.body.integrityDrive ?? bodyDelta.integrityDrive ?? 0) > URGENCY_THRESHOLD;
      if (urgencyOverride) {
        this.emitAndTrack({
          event_id: crypto.randomUUID(),
          branch_id: this.branchId,
          run_id: this.runId,
          tick,
          type: EventType.URGENCY_OVERRIDE,
          agent_id: agent.id,
          payload: {
            integrityDrive: agent.body.integrityDrive,
          },
        });
      }

      // 4j. Check immediate reactions (RECOIL, FLEE, COLLAPSE)
      const reaction = System1.checkImmediateReaction(agent);
      if (reaction) {
        this.emitAndTrack({
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

      // 4i. System2
      if (
        urgencyOverride ||
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
        agent.pendingSystem2 = true;
        totalDecisions++;
        const qualiaPacketId = hashQualiaPacket(agent.id, tick, qualiaText);
        pendingSystem2.push(
          this.system2
            .think(agent, qualiaText, filteredPercept, this.config, tick, this.branchId, {
              urgencyOverride,
              causal: {
                qualiaPacketId,
                sourceTick: tick,
              },
            })
            .then((output) => {
              if (output.innerMonologue) {
                agent.innerMonologue = output.innerMonologue;
                this.emitAndTrack({
                  event_id: crypto.randomUUID(),
                  branch_id: this.branchId,
                  run_id: this.runId,
                  tick,
                  type: EventType.SYSTEM2_THOUGHT,
                  agent_id: agent.id,
                  payload: { innerMonologue: output.innerMonologue },
                });
              }

              // 4l. Apply decision / update position
              if (output.decision && output.decision.type !== "IDLE") {
                if (this.checkDecisionLoop(agent.id, output.decision)) {
                  output.decision = this.breakDecisionLoop();
                }
                positionsChanged =
                  this.applyDecision(agent, {
                    type: output.decision.type,
                    position: output.decision.position,
                  }) || positionsChanged;
                this.emitAndTrack({
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
            })
            .catch((error) => {
              console.error("System2 think failed:", error);
            })
            .finally(() => {
              agent.pendingSystem2 = false;
              this.clock.resolvePendingMind();
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
        VocalActuationBroadcaster.broadcast(vocal, this.branchId, this.runId, this.eventBus);
      }
    }

    if (positionsChanged) {
      this.spatialIndex.rebuildIndex(this.agents);
    }

    if (deadAgentIds.length > 0) {
      for (const deadAgentId of deadAgentIds) {
        const deadAgent = this.agents.find((agent) => agent.id === deadAgentId);
        if (!deadAgent) continue;
        const witnesses = this.spatialIndex
          .getAgentsInRadius(deadAgent.position, 15)
          .filter((agent) => agent.id !== deadAgentId).length;
        const deathEventId = crypto.randomUUID();
        this.emitAndTrack({
          event_id: deathEventId,
          branch_id: this.branchId,
          run_id: this.runId,
          tick,
          type: EventType.AGENT_DIED,
          agent_id: deadAgentId,
          payload: {
            agent_id: deadAgentId,
            cause: "starvation",
            witness_count: witnesses,
          },
        });

        const biomassPosition = this.physics.convertDeadAgentToBiomass(deadAgent, this.world, tick);
        this.emitAndTrack({
          event_id: crypto.randomUUID(),
          branch_id: this.branchId,
          run_id: this.runId,
          tick,
          type: EventType.RESOURCE_CREATED,
          agent_id: deadAgentId,
          payload: {
            material: "biomass",
            position: biomassPosition,
            source_agent_id: deadAgentId,
          },
        });
        MerkleLogger.log(
          tick,
          this.branchId,
          deadAgentId,
          "Physics",
          "RESOURCE_CREATED",
          null,
          {
            material: "biomass",
            position: biomassPosition,
            source_agent_id: deadAgentId,
          },
          deathEventId,
          `agent_death=${deadAgentId}`,
        );
      }

      this.agents = this.agents.filter((agent) => !deadAgentIds.includes(agent.id));
      for (const deadAgentId of deadAgentIds) {
        this.recentDecisions.delete(deadAgentId);
      }
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
        this.runId,
        tick,
      );
    }
    this.vocalActuations = [];

    // 6. TechTree check discoveries
    for (const agent of this.agents) {
      this.techTree.checkDeathConceptDiscovery(agent);
    }

    const emergenceFindings = this.emergenceDetector.analyzeEventBatch(
      this.recentEventsWindow.slice(-200),
    );
    for (const finding of emergenceFindings) {
      this.emitAndTrack({
        event_id: crypto.randomUUID(),
        branch_id: this.branchId,
        run_id: this.runId,
        tick,
        type: EventType.EMERGENCE_DETECTED,
        payload: {
          name: finding.name,
          description: finding.description,
          confidence: finding.confidence,
        },
      });
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

    this.multiWorkerRuntime?.syncAgents(this.agents);
    try {
      await this.multiWorkerRuntime?.runTick(tick);
    } catch (error) {
      console.warn("Multi-worker phase execution failed; continuing inline.", error);
    }

    console.log(`[tick ${tick}] agents: ${this.agents.length}, system2_calls: ${totalDecisions}`);

    // Wait for async system2 if desired, but PRD says non-blocking tick.
    // However, for tests we might want to wait.
  }
}
