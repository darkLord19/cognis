import type { ActionOutcomeRecord } from "../../shared/types";
import type { ActionOutcomeMemory } from "./action-outcome-memory";

/**
 * AffordanceLearner identifies "helpful" or "harmful" actions by analyzing
 * the history of sensory contexts and their resulting physiological changes.
 */
export class AffordanceLearner {
  constructor(private memory: ActionOutcomeMemory) {}

  /**
   * Evaluates the learned "value" of a specific action in a specific sensory context.
   */
  public getLearnedValue(
    contextSignature: string,
    actionType: string,
  ): {
    confidence: number;
    utility: number; // Positive = likely helpful, Negative = likely harmful
    expectations: Partial<ActionOutcomeRecord>;
  } {
    const relevant = this.memory
      .findSimilarContexts(contextSignature)
      .filter((r) => r.actionType === actionType);

    if (relevant.length < 3) {
      return { confidence: 0, utility: 0, expectations: {} };
    }

    const count = relevant.length;
    const avgHydration = relevant.reduce((s, r) => s + r.deltaHydration, 0) / count;
    const avgEnergy = relevant.reduce((s, r) => s + r.deltaEnergy, 0) / count;
    const avgPain = relevant.reduce((s, r) => s + r.deltaPain, 0) / count;
    const avgToxin = relevant.reduce((s, r) => s + r.deltaToxin, 0) / count;
    const avgThreat = relevant.reduce((s, r) => s + r.deltaThreat, 0) / count;

    // Utility is a subjective measure of how "good" this action is for survival
    const utility = avgHydration * 2 + avgEnergy * 2 - avgPain * 3 - avgToxin * 4 - avgThreat * 2;

    return {
      confidence: Math.min(1.0, count / 10),
      utility,
      expectations: {
        deltaHydration: avgHydration,
        deltaEnergy: avgEnergy,
        deltaPain: avgPain,
        deltaToxin: avgToxin,
        deltaThreat: avgThreat,
      },
    };
  }

  /**
   * Scans all known actions for a context to find the "best" learned option.
   */
  public findBestAction(
    contextSignature: string,
    availableActions: string[],
  ): { actionType: string; utility: number; confidence: number } | null {
    let best = null;
    let maxUtility = -Infinity;

    for (const type of availableActions) {
      const affordance = this.getLearnedValue(contextSignature, type);
      if (affordance.confidence > 0.3 && affordance.utility > maxUtility) {
        maxUtility = affordance.utility;
        best = { actionType: type, utility: affordance.utility, confidence: affordance.confidence };
      }
    }

    return best;
  }
}
