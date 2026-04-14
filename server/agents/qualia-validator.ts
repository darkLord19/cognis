import type { LexiconEntry } from "../../shared/types";
import type { QualiaFrame } from "./qualia-types";

const ALWAYS_FORBIDDEN = [
  /\bsimulation\b/i,
  /\bcode\b/i,
  /\bdatabase\b/i,
  /\btick\b/i,
  /\bop-id\b/i,
  /\bMaterialType\b/i,
  /\bVoxelType\b/i,
  /\bTechNode\b/i,
  /\bcycleHormone\b/i,
  /\bintegrityDrive\b/i,
  /\b\d+\.\d{2,}\b/,
  /\bx\s*:/i,
  /\by\s*:/i,
  /\bz\s*:/i,
];

const CONCEPT_SPOILERS = [
  "hunger",
  "hungry",
  "thirst",
  "thirsty",
  "drink",
  "water",
  "eat",
  "food",
  "oxygen",
  "breathe",
  "fire",
  "death",
  "dead",
  "sleep",
];

export type ValidationResult = {
  valid: boolean;
  reason?: string;
  violations: string[];
};

export function validateQualiaOutput(text: string, lexicon: LexiconEntry[]): ValidationResult {
  const violations: string[] = [];

  for (const pattern of ALWAYS_FORBIDDEN) {
    if (pattern.test(text)) {
      violations.push(`forbidden_pattern:${pattern.source}`);
    }
  }

  const lexiconWords = new Set(lexicon.map((entry) => entry.word.toLowerCase()));
  const lexiconConcepts = new Set(lexicon.map((entry) => entry.concept.toLowerCase()));
  const allowsConcept = (concept: string): boolean =>
    lexiconWords.has(concept.toLowerCase()) || lexiconConcepts.has(concept.toLowerCase());

  for (const spoiler of CONCEPT_SPOILERS) {
    if (!allowsConcept(spoiler) && new RegExp(`\\b${spoiler}\\b`, "i").test(text)) {
      violations.push(`spoiler:${spoiler}`);
    }
  }

  const result: ValidationResult = {
    valid: violations.length === 0,
    violations,
  };
  if (violations.length > 0) {
    result.reason = "qualia_veil_violation";
  }
  return result;
}

export function validateQualia(frame: QualiaFrame, lexicon: LexiconEntry[] = []): boolean {
  return validateQualiaOutput(frame.narratableText, lexicon).valid;
}
