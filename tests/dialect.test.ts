import { expect, test } from "bun:test";
import { DialectTracker } from "../server/language/dialect";
import type { LexiconEntry } from "../shared/types";

test("DialectTracker: identical lexicons have zero distance", () => {
  const lexicon: LexiconEntry[] = [
    { word: "grok", concept: "fire", confidence: 0.8, consensusCount: 3 },
  ];

  const distance = DialectTracker.computeDistance(lexicon, lexicon);
  expect(distance).toBe(0);
});

test("DialectTracker: disjoint lexicons have distance 1", () => {
  const lexA: LexiconEntry[] = [
    { word: "grok", concept: "fire", confidence: 0.8, consensusCount: 3 },
  ];
  const lexB: LexiconEntry[] = [
    { word: "blit", concept: "water", confidence: 0.8, consensusCount: 3 },
  ];

  const distance = DialectTracker.computeDistance(lexA, lexB);
  expect(distance).toBe(1);
});

test("DialectTracker: partial overlap gives intermediate distance", () => {
  const lexA: LexiconEntry[] = [
    { word: "grok", concept: "fire", confidence: 0.8, consensusCount: 3 },
    { word: "blit", concept: "water", confidence: 0.8, consensusCount: 3 },
  ];
  const lexB: LexiconEntry[] = [
    { word: "grok", concept: "fire", confidence: 0.8, consensusCount: 3 },
    { word: "zap", concept: "light", confidence: 0.8, consensusCount: 3 },
  ];

  const distance = DialectTracker.computeDistance(lexA, lexB);
  // intersection=1, union=3, distance = 1 - 1/3 = 0.667
  expect(distance).toBeCloseTo(0.667, 2);
});

test("DialectTracker: empty lexicons have zero distance", () => {
  const distance = DialectTracker.computeDistance([], []);
  expect(distance).toBe(0);
});
