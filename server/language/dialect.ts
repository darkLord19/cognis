import type { LexiconEntry } from "../../shared/types";

export const DialectTracker = {
  computeDistance(lexiconA: LexiconEntry[], lexiconB: LexiconEntry[]): number {
    const setA = new Set(lexiconA.map((l) => `${l.word}:${l.concept}`));
    const setB = new Set(lexiconB.map((l) => `${l.word}:${l.concept}`));

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0;
    return 1 - intersection.size / union.size;
  },
};
