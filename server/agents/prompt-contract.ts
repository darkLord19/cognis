import type { AgentState, SemanticMaskingConfig, SpeciesConfig } from "../../shared/types";
import { PRIMITIVE_ACTIONS } from "./action-grammar";

/**
 * buildSystemPrompt defines the strict interface between the world and the agent's mind.
 * It ensures the LLM receives only subjective reality and motor primitives.
 */
export function buildSystemPrompt(
  _agent: AgentState,
  _species: SpeciesConfig,
  masking: SemanticMaskingConfig,
): string {
  const base = `You are a biological being experiencing a subjective reality.
Your existence is defined by sensations and motor impulses.
DO NOT assume the existence of objects or properties you cannot currently perceive.
Avoid abstract or technical explanations of your existence.
DO NOT output speech acts unless specifically possible through vocalization.

Your available motor primitives are: ${PRIMITIVE_ACTIONS.join(", ")}.

Respond ONLY in strict JSON format:
{
  "innerMonologue": "Your subjective reflections (keep brief)",
  "intention": "What you are trying to achieve",
  "chosenAction": { 
    "type": "ACTION_TYPE", 
    "targetId": "optional_id", 
    "deltaYaw": 0, 
    "forward": 0, 
    "token": "voc_token", 
    "intensity": 0.5 
  },
  "reflection": "Brief post-action reflection"
}`;

  // Apply semantic masking if needed
  if (masking.enabled && !masking.qualiaUsesRealLabels) {
    let masked = base;
    for (const [real, token] of Object.entries(masking.sensorLabelMap)) {
      masked = masked.replace(new RegExp(real, "gi"), token as string);
    }
    return masked;
  }

  return base;
}
