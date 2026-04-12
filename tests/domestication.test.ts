import { expect, test } from "bun:test";
import { DomesticationManager } from "../server/world/domestication";
import type { AgentState, SpeciesConfig } from "../shared/types";

test("DomesticationManager: skips non-domesticatable species", () => {
  const agent = { id: "a1" } as AgentState;
  const species = { canBedomesticated: false } as unknown as SpeciesConfig;

  // Should not throw
  DomesticationManager.update(agent, species);
});

test("DomesticationManager: processes domesticatable species", () => {
  const agent = { id: "a1" } as AgentState;
  const species = { canBedomesticated: true } as unknown as SpeciesConfig;

  // Should not throw (placeholder logic)
  DomesticationManager.update(agent, species);
});
