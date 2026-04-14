import type { EventBus } from "../../server/core/event-bus";
import { EventType } from "../../shared/events";
import type { AgentState, MaterialType } from "../../shared/types";
import { getMaterialAffordance } from "./material-affordances";

/**
 * IngestionSystem handles the physical outcome of INGEST_ATTEMPT or MOUTH_CONTACT.
 */
export class IngestionSystem {
  constructor(private eventBus: EventBus) {}

  /**
   * Processes a single ingestion event.
   * Modifies the agent's physiology directly based on material affordances.
   */
  public process(
    agent: AgentState,
    material: MaterialType,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    const affordance = getMaterialAffordance(material);

    // 1. Physical Update
    agent.body.energy = Math.min(1.0, agent.body.energy + affordance.energyGain);
    agent.body.hydration = Math.min(1.0, agent.body.hydration + affordance.hydrationGain);
    agent.body.toxinLoad = Math.min(1.0, agent.body.toxinLoad + affordance.toxinLoad);
    agent.body.arousal = Math.max(0, Math.min(1, agent.body.arousal + affordance.arousalDelta));

    if (affordance.painDelta > 0) {
      agent.body.bodyMap.head.pain = Math.min(
        1.0,
        agent.body.bodyMap.head.pain + affordance.painDelta,
      );
    }

    // 2. Emit Events for Learning and Analysis
    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.INGESTION_OCCURRED,
      agent_id: agent.id,
      payload: {
        material,
        gainEnergy: affordance.energyGain,
        gainHydration: affordance.hydrationGain,
      },
    });

    if (affordance.hydrationGain > 0) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.HYDRATION_IMPROVED,
        agent_id: agent.id,
        payload: { gain: affordance.hydrationGain },
      });
    }

    if (affordance.energyGain > 0) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.ENERGY_IMPROVED,
        agent_id: agent.id,
        payload: { gain: affordance.energyGain },
      });
    }

    if (affordance.toxinLoad > 0) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.TOXIN_EXPOSURE,
        agent_id: agent.id,
        payload: { load: affordance.toxinLoad },
      });
    }
  }
}
