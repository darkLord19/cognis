import {
  DECAY_ENGINE_INTERVAL_TICKS,
  SALIENCE_ENCODE_THRESHOLD,
  SNAPSHOT_INTERVAL_TICKS,
  URGENCY_THRESHOLD,
} from "../../shared/constants";
import type { SimEvent } from "../../shared/events";
import { EventType } from "../../shared/events";
import type {
  AgentState,
  PrimitiveAction,
  RawSensorBundle,
  VocalActuation,
  WorldConfig,
} from "../../shared/types";
import { ActionArbiter } from "../agents/action-arbiter";
import { ActionExecutor } from "../agents/action-executor";
import { ActuationType, type MotorPlan } from "../agents/action-grammar";
import { ActionOutcomeMemory } from "../agents/action-outcome-memory";
import { AffordanceLearner } from "../agents/affordance-learner";
import { AttentionFilter } from "../agents/attention-filter";
import { legacyAdapter } from "../agents/legacy-action-adapter";
import { ProceduralPolicy } from "../agents/procedural-policy";
import { QualiaProcessor } from "../agents/qualia-processor";
import { System0 } from "../agents/system0";
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
import { IngestionSystem } from "../world/ingestion";
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
  private system0: System0;
  private actionExecutor: ActionExecutor;
  private actionArbiter: ActionArbiter;
  private ingestionSystem: IngestionSystem;
  private agentLearning = new Map<
    string,
    {
      memory: ActionOutcomeMemory;
      learner: AffordanceLearner;
      policy: ProceduralPolicy;
    }
  >();

  private vocalActuations: VocalActuation[] = [];
  private emergenceDetector = new EmergenceDetector();
  private recentEventsWindow: SimEvent[] = [];
  private latestSensorBundles = new Map<string, RawSensorBundle>();
  private latestQualiaByAgent = new Map<string, { tick: number; text: string }>();
  private actionTraceByAgent = new Map<
    string,
    Array<{
      tick: number;
      source: MotorPlan["source"];
      primitives: MotorPlan["primitives"];
      reason?: string;
    }>
  >();

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
    this.system0 = new System0();
    this.actionExecutor = new ActionExecutor(eventBus);
    this.actionArbiter = new ActionArbiter();
    this.ingestionSystem = new IngestionSystem(eventBus);
  }

  public addAgent(agent: AgentState): void {
    this.agents.push(agent);

    // Initialize learning layer for this agent
    const memory = new ActionOutcomeMemory();
    const learner = new AffordanceLearner(memory);
    const policy = new ProceduralPolicy(learner);
    this.agentLearning.set(agent.id, { memory, learner, policy });

    this.spatialIndex.rebuildIndex(this.agents);
  }

  public getLatestSensorBundle(agentId: string): RawSensorBundle | null {
    return this.latestSensorBundles.get(agentId) ?? null;
  }

  public getLatestQualia(agentId: string): { tick: number; text: string } | null {
    return this.latestQualiaByAgent.get(agentId) ?? null;
  }

  public getActionTrace(
    agentId: string,
    limit = 50,
  ): Array<{
    tick: number;
    source: MotorPlan["source"];
    primitives: MotorPlan["primitives"];
    reason?: string;
  }> {
    const trace = this.actionTraceByAgent.get(agentId) ?? [];
    return trace.slice(-Math.max(1, limit));
  }

  public getProceduralMemory(agentId: string) {
    const learning = this.agentLearning.get(agentId);
    return learning ? learning.learner.getAllAffordances() : [];
  }

  private applyAction(agent: AgentState, action: PrimitiveAction, tick: number): void {
    const translated = legacyAdapter.translate(action.type, tick, Boolean(agent.body.mouthItem));
    if (translated) {
      this.recordActionTrace(agent.id, translated);
    }
    this.actionExecutor.execute(agent, action, tick, this.runId, this.branchId);
  }

  private applyMotorPlan(agent: AgentState, plan: MotorPlan, tick: number): void {
    this.recordActionTrace(agent.id, plan);
    this.actionExecutor.executeMotorPlan(agent, plan, tick, this.runId, this.branchId);
  }

  private recordActionTrace(agentId: string, plan: MotorPlan): void {
    const trace = this.actionTraceByAgent.get(agentId) ?? [];
    trace.push({
      tick: plan.createdAtTick,
      source: plan.source,
      primitives: plan.primitives,
      ...(plan.reason ? { reason: plan.reason } : {}),
    });
    this.actionTraceByAgent.set(agentId, trace.slice(-200));
  }

  public async tick(): Promise<void> {
    const tick = this.clock.getTick();
    this.multiWorkerRuntime?.syncAgents(this.agents);

    const deadAgentIds: string[] = [];

    let totalDecisions = 0;

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
      const reflexResults = this.system0.execute({
        agent,
        tick,
      });
      for (const reflex of reflexResults) {
        if (!reflex.fired) continue;
        this.eventBus.emit({
          event_id: crypto.randomUUID(),
          run_id: this.runId,
          branch_id: this.branchId,
          tick,
          type: EventType.REFLEX_FIRED,
          agent_id: agent.id,
          payload: {
            reflexId: reflex.id,
            intensity: reflex.intensity,
          },
        });
      }
      const reflexPlan = reflexResults.find(
        (result) => result.fired && result.motorPlan,
      )?.motorPlan;

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

      if (biomassConsumed > 0 && localVoxel?.material) {
        // Handle ingestion result
        this.ingestionSystem.process(agent, localVoxel.material, tick, this.runId, this.branchId);

        // Record for learning
        const learning = this.agentLearning.get(agent.id);
        if (learning) {
          learning.memory.record({
            contextSignature: localVoxel.material, // Simplified signature
            actionType: agent.currentAction?.type ?? "DEFER",
            deltaEnergy: (agent.body.energy ?? 0) - (oldBody.energy ?? 0),
            deltaHydration: (agent.body.hydration ?? 0) - (oldBody.hydration ?? 0),
            deltaPain: (agent.body.bodyMap.head.pain ?? 0) - (oldBody.bodyMap.head.pain ?? 0),
            deltaToxin: (agent.body.toxinLoad ?? 0) - (oldBody.toxinLoad ?? 0),
            deltaThreat: 0,
            success: true,
            tick,
          });
        }

        // Deplete resource in voxel
        const currentQuality = localVoxel.metadata?.resourceQuality ?? 1;
        const nextQuality = Math.max(0, currentQuality - biomassConsumed);

        if (nextQuality === 0) {
          this.world.set(localX, localY, localZ, {
            ...localVoxel,
            type: 2, // Assuming dirt type
            material: "dirt",
            metadata: {
              ...(localVoxel.metadata ?? {}),
              resourceQuality: 0,
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

      if (reflexPlan) {
        this.applyMotorPlan(agent, reflexPlan, tick);
        const reflexVocal = System1.checkVocalActuation(agent, tick);
        if (reflexVocal) {
          this.vocalActuations.push(reflexVocal);
          VocalActuationBroadcaster.broadcast(
            reflexVocal,
            this.branchId,
            this.runId,
            this.eventBus,
          );
        }
        totalDecisions++;
        continue;
      }

      const urgencyOverride =
        (agent.body.integrityDrive ?? bodyDelta.integrityDrive ?? 0) > URGENCY_THRESHOLD;

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

      // 4f. Qualia
      const qualiaText = QualiaProcessor.qualiaFor(
        agent,
        filteredPercept,
        EmotionalField.detectFields(agent, filteredPercept.primaryAttention, tick, this.branchId),
        FeelingResidueSystem.getMoodTint(agent.feelingResidues),
        circadianState,
        this.config,
      );
      this.latestQualiaByAgent.set(agent.id, { tick, text: qualiaText });

      // --- PROCEDURAL LEARNING LAYER ---
      const sensorBundle = SenseComputer.computeSensorBundle(
        agent,
        this.world,
        this.spatialIndex,
        this.config.perception,
        circadianState,
        this.vocalActuations,
        tick,
      );
      this.latestSensorBundles.set(agent.id, sensorBundle);

      const learning = this.agentLearning.get(agent.id);
      const contextSignature = localVoxel?.material ?? "void";
      const proceduralPlan = learning
        ? learning.policy.propose({
            agent,
            qualiaFrame: {
              agentId: agent.id,
              tick,
              body: [],
              world: [],
              social: [],
              urges: [],
              memories: [],
              narratableText: qualiaText,
            },
            sensorBundle,
            learnedAffordances: learning.learner.getCandidates(contextSignature),
            tick,
          })
        : undefined;

      const fallbackPlan: MotorPlan = {
        source: "fallback",
        urgency: 0.2,
        createdAtTick: tick,
        primitives: [
          {
            type: ActuationType.REST_POSTURE,
            target: { type: "self" },
            intensity: 0.3,
            durationTicks: 1,
          },
        ],
        reason: "fallback_idle",
      };

      // 4h. Salience & Persistence
      const event: SimEvent = {
        event_id: crypto.randomUUID(),
        branch_id: this.branchId,
        run_id: this.runId,
        tick,
        type: EventType.TICK,
        agent_id: agent.id,
        payload: { qualia: qualiaText },
      };
      this.eventBus.emit(event);

      const salience = SalienceGate.computeSalience(event, agent, this.config.memory);

      // 4i. System2
      const shouldCallSystem2 =
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
        );

      if (shouldCallSystem2) {
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
              }

              const system2Plan =
                output.decision && output.decision.type !== "DEFER"
                  ? (legacyAdapter.translate(
                      output.decision.type,
                      tick,
                      Boolean(agent.body.mouthItem),
                    ) ?? undefined)
                  : undefined;
              const arbitrationInput: {
                fallbackPlan: MotorPlan;
                proceduralPlan?: MotorPlan;
                system2Plan?: MotorPlan;
              } = { fallbackPlan };
              if (proceduralPlan) {
                arbitrationInput.proceduralPlan = proceduralPlan;
              }
              if (system2Plan) {
                arbitrationInput.system2Plan = system2Plan;
              }
              const finalPlan = this.actionArbiter.choose(arbitrationInput);

              if (!system2Plan && output.decision && output.decision.type !== "DEFER") {
                this.applyAction(agent, output.decision as PrimitiveAction, tick);
              } else {
                this.applyMotorPlan(agent, finalPlan, tick);
              }
              totalDecisions++;
            })
            .catch((error) => {
              console.error("System2 think failed:", error);
            })
            .finally(() => {
              agent.pendingSystem2 = false;
              this.clock.resolvePendingMind();
            }),
        );
      } else {
        const arbitrationInput: { fallbackPlan: MotorPlan; proceduralPlan?: MotorPlan } = {
          fallbackPlan,
        };
        if (proceduralPlan) {
          arbitrationInput.proceduralPlan = proceduralPlan;
        }
        const finalPlan = this.actionArbiter.choose(arbitrationInput);
        this.applyMotorPlan(agent, finalPlan, tick);
        totalDecisions++;
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
        if (other.body.valence === 0 && other.body.arousal === 0 && other.body.fatigue >= 1.0) {
          SemanticStore.trackDeathObservation(agent.id, this.branchId, "observed_agent_stillness");
          SemanticStore.trackDeathObservation(
            agent.id,
            this.branchId,
            "observed_absent_emotional_field",
          );
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

    if (deadAgentIds.length > 0) {
      for (const deadAgentId of deadAgentIds) {
        const deadAgent = this.agents.find((agent) => agent.id === deadAgentId);
        if (!deadAgent) continue;
        const witnesses = this.spatialIndex
          .getAgentsInRadius(deadAgent.position, 15)
          .filter((agent) => agent.id !== deadAgentId).length;
        const deathEventId = crypto.randomUUID();
        this.eventBus.emit({
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
        this.eventBus.emit({
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
      this.spatialIndex.rebuildIndex(this.agents);
    }

    // 5. Language
    for (const va of this.vocalActuations) {
      const emitter = this.agents.find((a) => a.id === va.emitterId);
      const emitterPos = emitter?.position ?? { x: 0, y: 0, z: 0 };
      const listeners = this.spatialIndex.getAgentsInRadius(emitterPos, 50);
      LanguageEmergence.processVocalActuation(
        va,
        listeners,
        [],
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
      this.eventBus.emit({
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
            energy: agent.body.energy,
            hydration: agent.body.hydration,
            fatigue: agent.body.fatigue,
            integrityDrive: agent.body.integrityDrive,
          }),
          null,
        );
      }
    }

    this.multiWorkerRuntime?.syncAgents(this.agents);
    console.log(`[tick ${tick}] agents: ${this.agents.length}, decisions: ${totalDecisions}`);
  }
}
