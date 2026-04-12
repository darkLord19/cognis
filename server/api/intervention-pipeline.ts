import { EventType } from "../../shared/events";
import { WillEngine } from "../agents/will-engine";
import type { RunSupervisor } from "../core/run-supervisor";
import { MerkleLogger } from "../persistence/merkle-logger";

type InterventionResult = {
  success: boolean;
  resisted?: boolean;
  message: string;
};

type SupportedIntervention = "integrity_drive_delta" | "fatigue_spike" | "pain_spike";

export class InterventionPipeline {
  constructor(private runSupervisor: RunSupervisor) {}

  applyIntervention(
    runId: string,
    agentId: string,
    interventionType: string,
    intensity: number,
  ): InterventionResult {
    const runtime = this.runSupervisor.getRuntime(runId);
    if (!runtime?.orchestrator) {
      return { success: false, message: "Runtime not found" };
    }

    const agent = runtime.orchestrator.getAgents().find((a) => a.id === agentId);
    if (!agent) return { success: false, message: "Agent not found" };

    if (WillEngine.checkResistance(agent, runtime.worldConfig, intensity)) {
      MerkleLogger.log(
        runtime.clock.getTick(),
        runtime.branchId,
        agentId,
        "WillEngine",
        "intervention_resistance",
        null,
        `resisted:${intensity}`,
        null,
      );

      runtime.eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: runtime.branchId,
        run_id: runId,
        tick: runtime.clock.getTick(),
        type: EventType.INTERVENTION_RESISTED,
        agent_id: agentId,
        payload: { intervention: interventionType, intensity },
      });

      return { success: false, resisted: true, message: "Intervention resisted" };
    }

    const supportedType = interventionType as SupportedIntervention;
    let oldValue = 0;
    let newValue = 0;

    switch (supportedType) {
      case "integrity_drive_delta":
        oldValue = agent.body.integrityDrive;
        newValue = Math.max(0, oldValue - intensity);
        agent.body.integrityDrive = newValue;
        break;
      case "fatigue_spike":
        oldValue = agent.body.fatigue;
        newValue = Math.min(1, oldValue + intensity);
        agent.body.fatigue = newValue;
        break;
      case "pain_spike":
        oldValue = agent.body.bodyMap.head.pain;
        newValue = Math.min(1, oldValue + intensity);
        agent.body.bodyMap.head.pain = newValue;
        break;
      default:
        return { success: false, message: `Unsupported intervention type: ${interventionType}` };
    }

    MerkleLogger.log(
      runtime.clock.getTick(),
      runtime.branchId,
      agentId,
      "Intervention",
      "intervention_application",
      String(oldValue),
      String(newValue),
      null,
    );

    if (supportedType === "integrity_drive_delta") {
      MerkleLogger.log(
        runtime.clock.getTick(),
        runtime.branchId,
        agentId,
        "Intervention",
        "identity_scarring",
        String(oldValue),
        String(newValue),
        null,
      );
    }

    runtime.eventBus.emit({
      event_id: crypto.randomUUID(),
      branch_id: runtime.branchId,
      run_id: runId,
      tick: runtime.clock.getTick(),
      type: EventType.INTERVENTION_APPLIED,
      agent_id: agentId,
      payload: { intervention: interventionType, intensity },
    });

    return { success: true, message: "Intervention applied" };
  }
}
