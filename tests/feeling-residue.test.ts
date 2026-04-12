import { expect, test } from "bun:test";
import { FeelingResidueSystem } from "../server/perception/feeling-residue";
import type { FeelingResidue } from "../shared/types";

test("FeelingResidueSystem: getMoodTint returns average", () => {
  const residues: FeelingResidue[] = [
    { id: "r1", tick: 1, valence: 0.8, arousal: 0.6, sourceEventId: "e1" },
    { id: "r2", tick: 2, valence: -0.4, arousal: 0.2, sourceEventId: "e2" },
  ];

  const tint = FeelingResidueSystem.getMoodTint(residues);

  expect(tint.valence).toBeCloseTo(0.2);
  expect(tint.arousal).toBeCloseTo(0.4);
});

test("FeelingResidueSystem: getMoodTint of empty is zero", () => {
  const tint = FeelingResidueSystem.getMoodTint([]);

  expect(tint.valence).toBe(0);
  expect(tint.arousal).toBe(0);
});

test("FeelingResidueSystem: addResidue pushes to array", () => {
  const residues: FeelingResidue[] = [];
  FeelingResidueSystem.addResidue(residues, 0.5, 0.3, 10, "evt1");

  expect(residues.length).toBe(1);
  expect(residues[0]?.valence).toBe(0.5);
});

test("FeelingResidueSystem: tickResidues decays values", () => {
  const residues: FeelingResidue[] = [
    { id: "r1", tick: 1, valence: 0.5, arousal: 0.5, sourceEventId: "e1" },
  ];

  FeelingResidueSystem.tickResidues(residues, 0.1);

  expect(residues[0]?.valence).toBeCloseTo(0.45);
  expect(residues[0]?.arousal).toBeCloseTo(0.45);
});

test("FeelingResidueSystem: tickResidues removes near-zero residues", () => {
  const residues: FeelingResidue[] = [
    { id: "r1", tick: 1, valence: 0.005, arousal: 0.005, sourceEventId: "e1" },
  ];

  FeelingResidueSystem.tickResidues(residues, 0.5);

  expect(residues.length).toBe(0);
});
