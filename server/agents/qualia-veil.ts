import type { LexiconEntry } from "../../shared/types";
import type { QualiaSegment } from "./qualia-types";

const SPOILER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bhunger\b/gi, "hollow pull"],
  [/\bhungry\b/gi, "hollow"],
  [/\bthirst\b/gi, "dry pull"],
  [/\bthirsty\b/gi, "dry"],
  [/\bdrink\b/gi, "swallow"],
  [/\bwater\b/gi, "cool relief"],
  [/\beat\b/gi, "mouth and swallow"],
  [/\bfood\b/gi, "nourishing thing"],
  [/\boxygen\b/gi, "air"],
  [/\bbreathe\b/gi, "draw air"],
  [/\bfire\b/gi, "searing heat"],
  [/\bdeath\b/gi, "ending stillness"],
  [/\bdead\b/gi, "still"],
  [/\bsleep\b/gi, "deep rest"],
];

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bsimulation\b/gi,
  /\bai\b/gi,
  /\bcode\b/gi,
  /\bdatabase\b/gi,
  /\bcoordinates?\b/gi,
  /\bmaterialtype\b/gi,
  /\bvoxeltype\b/gi,
  /\b[a-z]+_id\b/gi,
  /\btick\b/gi,
];

function lexiconAllows(lexicon: LexiconEntry[], term: string): boolean {
  const lowered = term.toLowerCase();
  return lexicon.some(
    (entry) => entry.word.toLowerCase() === lowered || entry.concept.toLowerCase() === lowered,
  );
}

export function applySapirWhorfGate(
  segments: QualiaSegment[],
  lexicon: LexiconEntry[],
): QualiaSegment[] {
  return segments.map((segment) => {
    let text = segment.text;

    for (const [pattern, replacement] of SPOILER_REPLACEMENTS) {
      const key = pattern.source.replace(/\\b|\(\?:|\)/g, "").replace(/\\/, "");
      if (!lexiconAllows(lexicon, key)) {
        text = text.replace(pattern, replacement);
      }
    }

    return { ...segment, text };
  });
}

export function enforceQualiaVeil(input: string): string {
  let value = input;
  for (const pattern of FORBIDDEN_PATTERNS) {
    value = value.replace(pattern, "veil");
  }
  return value;
}
