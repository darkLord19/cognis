import { expect, test } from "bun:test";
import { V1_MATERIALS } from "../server/world/material-affordances";

test("material affordances: v1 catalog includes hydration, edible, and toxic materials", () => {
  expect(V1_MATERIALS.fresh_water?.hydrationValue).toBeGreaterThan(0.5);
  expect(V1_MATERIALS.edible_soft_plant?.nutritionalValue).toBeGreaterThan(0.2);
  expect(V1_MATERIALS.toxic_bitter_plant?.toxicity).toBeGreaterThan(0.5);
});

test("material affordances: toxic bitter plant has delayed onset and bitter channel", () => {
  const toxic = V1_MATERIALS.toxic_bitter_plant;
  expect(toxic?.toxicityOnsetTicks).toBeGreaterThan(0);
  expect(toxic?.tasteProfile?.channel3).toBeGreaterThan(0.9);
});
