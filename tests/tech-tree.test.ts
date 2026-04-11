import { expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { TechTree } from "../server/world/tech-tree";
import type { AgentState, TechNode } from "../shared/types";

test("TechTree: death concept discovery unlocks and emits", () => {
  const bus = new EventBus();
  const techTree = new TechTree(bus);

  const deathNode: TechNode = {
    id: "death_concept",
    name: "Death",
    prerequisites: [],
    discoveryConditions: [],
    effects: [],
    canBeTeaching: true,
    teachingRequiresLexicon: ["death"],
    isDeathConcept: true,
  };

  techTree.load([deathNode]);

  const agent = {
    id: "agent_1",
    semanticStore: [
      { concept: "observed_agent_stillness", sourceCount: 5 },
      { concept: "observed_absent_emotional_field", sourceCount: 5 },
      { concept: "observed_cold_body", sourceCount: 5 },
    ],
    selfNarrative: "I am.",
  } as AgentState;

  let emitted = false;
  bus.onAny(() => (emitted = true));

  const discovered = techTree.checkDeathConceptDiscovery(agent);
  expect(discovered).toBe(true);
  expect(emitted).toBe(true);
  expect(agent.selfNarrative).toContain("I understand that we end");
  expect(techTree.hasDiscovered(agent.id, "death_concept")).toBe(true);
});
