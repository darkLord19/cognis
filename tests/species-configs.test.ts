import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpeciesConfig } from "../shared/types";

function loadSpecies(name: string): SpeciesConfig {
  const path = join(import.meta.dir, `../data/species/${name}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as SpeciesConfig;
}

test("Species configs: wolf and deer run with full_llm cognition", () => {
  const wolf = loadSpecies("wolf");
  const deer = loadSpecies("deer");

  expect(wolf.cognitiveTier).toBe("full_llm");
  expect(deer.cognitiveTier).toBe("full_llm");
});

test("Species configs: wolf and deer use neutral ecological roles", () => {
  const wolf = loadSpecies("wolf");
  const deer = loadSpecies("deer");

  expect(wolf.ecologicalRole).toBe("neutral");
  expect(deer.ecologicalRole).toBe("neutral");
});
