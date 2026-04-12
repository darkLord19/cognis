import { expect, test } from "bun:test";
import { DialectTracker } from "../server/language/dialect";
import type { LexiconEntry } from "../shared/types";

test("DialectTracker: computes Jaccard distance between lexicons", () => {
  const lexA: LexiconEntry[] = [
    { word: "A", concept: "1", confidence: 1, consensusCount: 1 },
    { word: "B", concept: "2", confidence: 1, consensusCount: 1 },
  ];

  const lexB: LexiconEntry[] = [
    { word: "A", concept: "1", confidence: 1, consensusCount: 1 },
    { word: "C", concept: "3", confidence: 1, consensusCount: 1 },
  ];

  // Intersection = {A:1} (size 1)
  // Union = {A:1, B:2, C:3} (size 3)
  // Distance = 1 - 1/3 = 0.666...

  const dist = DialectTracker.computeDistance(lexA, lexB);
  expect(dist).toBeCloseTo(0.666, 2);

  // Same lexicons -> distance 0
  expect(DialectTracker.computeDistance(lexA, lexA)).toBe(0);

  // Totally different -> distance 1
  const lexC: LexiconEntry[] = [{ word: "X", concept: "9", confidence: 1, consensusCount: 1 }];
  expect(DialectTracker.computeDistance(lexA, lexC)).toBe(1);
});
