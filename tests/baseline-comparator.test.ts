import { expect, test } from "bun:test";
import { BaselineComparator } from "../server/analysis/baseline-comparator";

test("BaselineComparator: A=yes B=no C=no → confabulation", () => {
  expect(BaselineComparator.compareFindings(true, false, false)).toBe("confabulation");
});

test("BaselineComparator: A=yes B=no C=yes → genuine_emergence", () => {
  expect(BaselineComparator.compareFindings(true, false, true)).toBe("genuine_emergence");
});

test("BaselineComparator: A=yes B=yes C=yes → physical_substrate", () => {
  expect(BaselineComparator.compareFindings(true, true, true)).toBe("physical_substrate");
});

test("BaselineComparator: A=yes B=yes C=no → semantic_dependent", () => {
  expect(BaselineComparator.compareFindings(true, true, false)).toBe("semantic_dependent");
});

test("BaselineComparator: A=no → confabulation regardless of B and C", () => {
  expect(BaselineComparator.compareFindings(false, true, true)).toBe("confabulation");
  expect(BaselineComparator.compareFindings(false, false, true)).toBe("confabulation");
  expect(BaselineComparator.compareFindings(false, true, false)).toBe("confabulation");
  expect(BaselineComparator.compareFindings(false, false, false)).toBe("confabulation");
});

test("BaselineComparator: generateReport returns string", () => {
  const report = BaselineComparator.generateReport("fire_discovery");
  expect(report).toContain("fire_discovery");
});

test("BaselineComparator: compares embodied metrics against random baseline", () => {
  const result = BaselineComparator.compareEmbodied(
    {
      survivalTicks: 250,
      repeatedReliefActionRate: 0.62,
      toxinAvoidanceAfterExposure: 0.8,
      proceduralActionRatio: 0.7,
      system2ActionRatio: 0.3,
      veilBreachCount: 0,
    },
    {
      survivalTicks: 160,
      repeatedReliefActionRate: 0.35,
      toxinAvoidanceAfterExposure: 0.45,
      proceduralActionRatio: 0.5,
      system2ActionRatio: 0.5,
      veilBreachCount: 0,
    },
  );

  expect(result.beatsRandomBaseline).toBe(true);
  expect(result.survivalImprovement).toBeGreaterThan(1.25);
});
