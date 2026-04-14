import { expect, test } from "bun:test";
import { SpeciesRegistry } from "../server/species/registry";

test("SpeciesRegistry: loads v5.2 species definition and compatibility config", () => {
  const registry = new SpeciesRegistry();
  registry.loadAll();

  const definition = registry.getDefinition("proto-human-forager");
  expect(definition).toBeDefined();
  expect(definition?.metabolism.hydrationDrainPerTick).toBeGreaterThan(0);
  expect(definition?.actuators.canWalk).toBe(true);

  const legacy = registry.get("proto-human-forager");
  expect(legacy).toBeDefined();
  expect(legacy?.name).toBe("Proto Human Forager");
  expect(legacy?.senseProfile.sight).toBe(30);
  expect(legacy?.baseStats.reachRange).toBe(2);
});
