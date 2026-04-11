import type { AgentState, EmotionalFieldDetection } from "../../shared/types";
import { MerkleLogger } from "../persistence/merkle-logger";

export class EmotionalField {
  public static detectFields(
    agent: AgentState,
    nearbyAgents: AgentState[],
    tick: number,
    branchId: string,
  ): EmotionalFieldDetection[] {
    const detections: EmotionalFieldDetection[] = [];

    for (const other of nearbyAgents) {
      if (other.id === agent.id) continue;

      // "suppressed fields: logged to audit ... invisible to agents"
      // Assume if a field is suppressed, we log and continue
      // For this example, let's say if valence is exactly 0, it's suppressed (just a mock rule)
      const isSuppressed = other.body.valence === 0 && other.body.arousal === 0;

      if (isSuppressed) {
        MerkleLogger.logSuppression(
          agent.id,
          branchId,
          "emotional_field",
          `Detected suppressed field from ${other.id}`,
          tick,
        );
      } else {
        detections.push({
          sourceAgentId: other.id,
          valenceImpression: other.body.valence,
          arousalImpression: other.body.arousal,
        });
      }
    }

    return detections;
  }
}
