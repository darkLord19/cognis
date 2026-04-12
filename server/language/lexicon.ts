import type { LexiconEntry } from "../../shared/types";

export const LexiconManager = {
  addEntry(lexicon: LexiconEntry[], word: string, concept: string): void {
    const existing = lexicon.find((l) => l.word === word && l.concept === concept);
    if (existing) {
      existing.consensusCount++;
      existing.confidence = Math.min(1.0, existing.confidence + 0.05);
    } else {
      lexicon.push({ word, concept, confidence: 0.5, consensusCount: 1 });
    }
  },
};
