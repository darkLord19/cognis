import type { ActionDecision, System2Output } from "../../shared/types";
import { isPrimitiveAction } from "./action-grammar";

/**
 * parseSystem2Output extracts and validates the agent's cognition output.
 */
export function parseSystem2Output(rawResponse: string): System2Output {
  try {
    const jsonStr = extractJsonObject(rawResponse);
    const parsed = JSON.parse(jsonStr);

    return {
      innerMonologue: normalizeString(parsed.innerMonologue),
      intention: normalizeString(parsed.intention),
      decision: normalizeDecision(parsed.chosenAction || parsed.decision),
      reflection: normalizeString(parsed.reflection),
      utterance: parsed.utterance, // Optional for Stage 2 language
      theoriesAboutOthers: parsed.theoriesAboutOthers || [],
    };
  } catch (e) {
    console.error("System2Parser failed:", e);
    return {
      innerMonologue: "I am confused.",
      intention: "I am trying to understand.",
      decision: { type: "DEFER" },
      reflection: "Confusion remains.",
    };
  }
}

function extractJsonObject(raw: string): string {
  const codeFenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeFenceMatch?.[1] ?? raw;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found");
  return jsonMatch[0].replace(/\/\/.*$/gm, ""); // Remove comments
}

function normalizeString(val: unknown): string {
  return typeof val === "string" ? val : "I am silent.";
}

function normalizeDecision(val: unknown): ActionDecision {
  if (
    !val ||
    typeof val !== "object" ||
    !("type" in val) ||
    typeof val.type !== "string" ||
    !isPrimitiveAction(val.type)
  ) {
    return { type: "DEFER" };
  }
  return val as ActionDecision;
}
