import type { AgentState, FilteredPercept, System2Output } from "../../shared/types";

/**
 * validateImpossibleKnowledge ensures the agent is not hallucinating target IDs
 * or properties that were not present in their Qualia or Attention.
 */
export function validateImpossibleKnowledge(
  agent: AgentState,
  output: System2Output,
  percept: FilteredPercept,
): boolean {
  const decision = output.decision as { type: string; targetId?: string };

  // Check target existence in primary attention
  if (decision.targetId) {
    const targetInAttention = percept.primaryAttention.some(
      (a: AgentState) => a.id === decision.targetId,
    );
    // Also check focused voxels or other perceptual fields if needed

    if (!targetInAttention && decision.type !== "DEFER" && decision.type !== "STOP") {
      console.warn(
        `ImpossibleKnowledgeCheck: Agent ${agent.id} targeted unknown ID ${decision.targetId}`,
      );
      return false;
    }
  }

  return true;
}
