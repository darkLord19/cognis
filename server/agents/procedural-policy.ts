import type { AgentState, PrimitiveAction } from "../../shared/types";
import type { AffordanceLearner } from "./affordance-learner";

/**
 * ProceduralPolicy acts as the "Missing Middle" between reflexes and cognition.
 * It manages the transition from exploratory learning to high-confidence habits.
 */
export class ProceduralPolicy {
  constructor(private learner: AffordanceLearner) {}

  /**
   * Decides whether to offer a procedural action instead of calling System 2.
   */
  public proposeAction(
    agent: AgentState,
    contextSignature: string,
    availableActions: string[],
  ): PrimitiveAction | null {
    const pressure = agent.body.integrityDrive;

    const bestLearned = this.learner.findBestAction(contextSignature, availableActions);

    if (!bestLearned) return null;

    // Arbitration Rules:
    // 1. Urgent Procedural: If pressure is high and habit is high-confidence.
    // 2. Efficient Habit: If habit is very high confidence, save LLM cost.

    const urgencyThreshold = pressure > 0.8 ? 0.4 : 0.85;
    const isHabitCandidate = bestLearned.confidence >= urgencyThreshold && bestLearned.utility > 0;

    if (isHabitCandidate) {
      // Map the string type back to a PrimitiveAction object.
      // Note: This logic will need to handle targets for REACH/GRASP/etc.
      return this.mapToPrimitive(bestLearned.actionType, agent);
    }

    return null;
  }

  private mapToPrimitive(type: string, _agent: AgentState): PrimitiveAction | null {
    // For now, only simple types are mapped; others return DEFER
    switch (type) {
      case "MOVE":
        return { type: "MOVE", forward: 1.0 };
      case "TURN":
        return { type: "TURN", deltaYaw: 0.1 };
      case "REST":
        return { type: "REST" };
      case "STOP":
        return { type: "STOP" };
      default:
        return null;
    }
  }
}
