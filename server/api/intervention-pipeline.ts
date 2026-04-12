import { EventType } from "../../shared/events";
import type { RunSupervisor } from "../core/run-supervisor";
import { MerkleLogger } from "../persistence/merkle-logger";

export class InterventionPipeline {
  constructor(private runSupervisor: RunSupervisor) {}

  applyIntervention(
    runId: string,
    agentId: string,
    interventionType: string,
    intensity: number,
  ): { success: boolean; message: string } {
    const runtime = this.runSupervisor.getRuntime(runId);
    if (!runtime || !runtime.orchestrator) {
      return { success: false, message: "Runtime not found" };
    }

    const agent = runtime.orchestrator.getAgents().find((a) => a.id === agentId);
    if (!agent) return { success: false, message: "Agent not found" };

    // Resistance check via WillEngine (placeholder logic for now as WillEngine is not yet fully integrated)
    // PRD: checkResistance()

    // Apply mutation: e.g., scar the agent's body map
    agent.body.integrityDrive -= intensity * 0.1;

    MerkleLogger.log(
      runtime.clock.getTick(),
      runtime.branchId,
      agentId,
      "Intervention",
      interventionType,
      "applied",
      String(intensity),
      null,
    );

    runtime.eventBus.emit({
      event_id: crypto.randomUUID(),
      branch_id: runtime.branchId,
      run_id: runId,
      tick: runtime.clock.getTick(),
      type: EventType.DECISION_MADE,
      agent_id: agentId,
      payload: { intervention: interventionType, intensity },
    });

    return { success: true, message: "Intervention applied" };
  }
}
