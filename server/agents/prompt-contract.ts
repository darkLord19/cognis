import type { LexiconEntry, PerceptualRef } from "../../shared/types";
import type { ActuationType } from "./action-grammar";
import type { QualiaFrame } from "./qualia-types";

export type System2PromptInput = {
  qualia: QualiaFrame;
  recentMemories: string[];
  semanticBeliefs: string[];
  availablePerceptualRefs: PerceptualRef[];
  allowedActuations: ActuationType[];
};

function renderPerceptualRefs(refs: PerceptualRef[]): string {
  if (refs.length === 0) return "- none";
  return refs
    .map((item) => {
      const direction = item.approximateDirection ? ` ${item.approximateDirection}` : "";
      return `- ${item.ref} (${item.kind}${direction})`;
    })
    .join("\n");
}

function renderList(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSystem2Prompt(input: System2PromptInput): string {
  const allowList = input.allowedActuations.join(", ");
  const refs = renderPerceptualRefs(input.availablePerceptualRefs);
  const memories = renderList(input.recentMemories, "- none");
  const beliefs = renderList(input.semanticBeliefs, "- none");

  return `You are an embodied host.
Use only currently available perceptual references and motor primitives.
You may move, look, reach, grasp, release, bring something toward your mouth, open your mouth, bite, chew, swallow, spit, vocalize, rest, or attend to a sensation.
Never use material IDs, coordinates, hidden variables, or symbolic actions.
Return STRICT JSON only. No markdown.

Qualia:
${input.qualia.narratableText}

Recent memories:
${memories}

Semantic beliefs:
${beliefs}

Available perceptual refs:
${refs}

Allowed actuations:
${allowList}

Return exactly:
{
  "thought": "string",
  "motorPlan": {
    "primitives": [
      {
        "type": "one of allowed actuations",
        "target": { "type": "self|perceptual_ref|direction|none", "ref": "only for perceptual_ref", "direction": "front|left|right|behind only for direction" },
        "intensity": 0.0,
        "durationTicks": 1
      }
    ]
  },
  "vocalization": "optional string",
  "memoryNote": "optional string"
}`;
}

export function isLexiconAllowedWord(word: string, lexicon: LexiconEntry[]): boolean {
  const normalized = word.trim().toLowerCase();
  return lexicon.some(
    (entry) =>
      entry.word.toLowerCase() === normalized || entry.concept.toLowerCase() === normalized,
  );
}
