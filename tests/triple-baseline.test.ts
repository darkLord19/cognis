import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TripleBaseline } from "../server/research/triple-baseline";
import { SpeciesRegistry } from "../server/species/registry";
import type { WorldConfig } from "../shared/types";

test("TripleBaseline.spawn prepares A B and C configs from the species registry", () => {
  const configPath = join(import.meta.dir, "../data/world-configs/earth-default.json");
  const baseConfig = JSON.parse(readFileSync(configPath, "utf8")) as WorldConfig;

  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();

  const plan = TripleBaseline.spawn(baseConfig, speciesRegistry.getAll());

  expect(plan.configA.meta.name).toBe("Earth Default A");
  expect(plan.configB.meta.name).toBe("Earth Default B");
  expect(plan.configC.meta.name).toBe("Earth Default C");
  expect(plan.configA.species.length).toBeGreaterThan(0);
  expect(plan.configA.species.some((species) => species.cognitiveTier === "full_llm")).toBe(true);
  expect(plan.configB.species.every((species) => species.cognitiveTier === "pure_reflex")).toBe(
    true,
  );
  expect(plan.configC.semanticMasking.qualiaUsesRealLabels).toBe(false);
});
