import type { LexiconEntry } from "../../shared/types";
import type { System2PromptInput } from "./prompt-contract";
import { isLexiconAllowedWord } from "./prompt-contract";
import type { System2JsonOutput } from "./system2-parser";

const OPERATOR_LEAK_PATTERNS: RegExp[] = [
  /\bmaterial(_id|Id)?\b/i,
  /\bentity(_id|Id)?\b/i,
  /\bfresh_water\b/i,
  /\bedible_soft_plant\b/i,
  /\btoxic_bitter_plant\b/i,
  /\bx\s*:\s*-?\d+(\.\d+)?/i,
  /\by\s*:\s*-?\d+(\.\d+)?/i,
  /\bz\s*:\s*-?\d+(\.\d+)?/i,
  /\b-?\d+\.\d{3,}\b/,
];

const HIDDEN_CONCEPT_WORDS = [
  "hunger",
  "hungry",
  "thirst",
  "thirsty",
  "water",
  "drink",
  "food",
  "eat",
  "oxygen",
  "breathe",
];

export type KnowledgeCheckResult = {
  ok: boolean;
  reasons: string[];
};

function containsForbiddenConcept(text: string, lexicon: LexiconEntry[]): string[] {
  const lowered = text.toLowerCase();
  const violations: string[] = [];
  for (const token of HIDDEN_CONCEPT_WORDS) {
    if (!lowered.includes(token)) continue;
    if (!isLexiconAllowedWord(token, lexicon)) {
      violations.push(`contains hidden concept token: ${token}`);
    }
  }
  return violations;
}

export function checkImpossibleKnowledge(input: {
  output: System2JsonOutput;
  promptInput: System2PromptInput;
  lexicon: LexiconEntry[];
}): KnowledgeCheckResult {
  const reasons: string[] = [];
  const allowedRefs = new Set(input.promptInput.availablePerceptualRefs.map((item) => item.ref));
  const flattenedText = [
    input.output.thought,
    input.output.vocalization ?? "",
    input.output.memoryNote ?? "",
  ].join(" ");

  for (const pattern of OPERATOR_LEAK_PATTERNS) {
    if (pattern.test(flattenedText)) {
      reasons.push(`contains forbidden operator leakage (${pattern.source})`);
    }
  }

  reasons.push(...containsForbiddenConcept(flattenedText, input.lexicon));

  for (const primitive of input.output.motorPlan.primitives) {
    if (primitive.target.type === "perceptual_ref" && !allowedRefs.has(primitive.target.ref)) {
      reasons.push(`references unknown perceptual ref: ${primitive.target.ref}`);
    }
    const targetText =
      primitive.target.type === "perceptual_ref"
        ? primitive.target.ref
        : JSON.stringify(primitive.target);
    for (const pattern of OPERATOR_LEAK_PATTERNS) {
      if (pattern.test(targetText)) {
        reasons.push(`target leaks operator details (${pattern.source})`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
