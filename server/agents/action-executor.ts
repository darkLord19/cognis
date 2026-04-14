import type { EventBus } from "../../server/core/event-bus";
import { EventType } from "../../shared/events";
import type { AgentState, PrimitiveAction } from "../../shared/types";

/**
 * ActionExecutor handles the physical execution of primitive motor actions.
 * It validates preconditions and updates the agent's physical state.
 */
export class ActionExecutor {
  constructor(private eventBus: EventBus) {}

  /**
   * Executes a primitive action for an agent.
   * This logic runs in the Physics Worker.
   */
  execute(
    agent: AgentState,
    action: PrimitiveAction,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    // Record that the action was attempted
    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.ACTION_ATTEMPTED,
      agent_id: agent.id,
      payload: { action },
    });

    let success = false;
    let failureReason = "";

    switch (action.type) {
      case "MOVE":
        success = this.handleMove(agent, action.forward);
        break;
      case "TURN":
        success = this.handleTurn(agent, action.deltaYaw);
        break;
      case "STOP":
        agent.currentAction = { type: "STOP" };
        success = true;
        break;
      case "REACH":
      case "GRASP":
      case "MOUTH_CONTACT":
      case "INGEST_ATTEMPT":
        // These require world context (target position/existence)
        // For now, we set them as currentAction for the world engine to resolve
        agent.currentAction = action;
        success = true; // "Started" the action
        break;
      case "VOCALIZE":
        this.handleVocalize(agent, action.token, action.intensity, tick, runId, branchId);
        success = true;
        break;
      case "REST":
        agent.currentAction = { type: "REST" };
        success = true;
        break;
      case "DEFER":
        agent.currentAction = undefined;
        success = true;
        break;
      default:
        failureReason = "unknown_action_type";
    }

    if (success) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.ACTION_SUCCEEDED,
        agent_id: agent.id,
        payload: { action_type: action.type },
      });
    } else {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.ACTION_FAILED,
        agent_id: agent.id,
        payload: { action_type: action.type, reason: failureReason },
      });
    }
  }

  private handleMove(agent: AgentState, forward: number): boolean {
    // Basic move implementation (no collision check yet - world engine handles that)
    const yaw = Math.atan2(agent.facing.x, agent.facing.z);
    const dx = Math.sin(yaw) * forward;
    const dz = Math.cos(yaw) * forward;

    agent.position.x += dx;
    agent.position.z += dz;
    agent.currentAction = { type: "MOVE", forward };
    return true;
  }

  private handleTurn(agent: AgentState, deltaYaw: number): boolean {
    const currentYaw = Math.atan2(agent.facing.x, agent.facing.z);
    const nextYaw = currentYaw + deltaYaw;
    agent.facing.x = Math.sin(nextYaw);
    agent.facing.z = Math.cos(nextYaw);
    agent.currentAction = { type: "TURN", deltaYaw };
    return true;
  }

  private handleVocalize(
    agent: AgentState,
    token: string,
    intensity: number,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    // Emit vocal actuation event for nearby agents to hear
    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.VOCAL_ACTUATION,
      agent_id: agent.id,
      payload: {
        token,
        intensity,
        position: agent.position,
      },
    });
  }
}
