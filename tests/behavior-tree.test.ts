import { expect, test } from "bun:test";
import { BehaviorTree } from "../server/species/behavior-tree";
import type { AgentState } from "../shared/types";

const createAgent = (speciesId: string, hunger: number, integrityDrive: number): AgentState => {
  return {
    id: "a1",
    speciesId,
    body: { hunger, integrityDrive },
  } as unknown as AgentState;
};

test("BehaviorTree: wolf hunts when hungry", () => {
  const agent = createAgent("wolf", 0.8, 0);
  const decision = BehaviorTree.tick(agent);

  expect(decision.type).toBe("MOVE");
  expect(decision.params?.goal).toBe("hunt");
});

test("BehaviorTree: deer flees on high integrity drive", () => {
  const agent = createAgent("deer", 0, 0.8);
  const decision = BehaviorTree.tick(agent);

  expect(decision.type).toBe("MOVE");
  expect(decision.params?.goal).toBe("flee");
});

test("BehaviorTree: wolf idles when not hungry", () => {
  const agent = createAgent("wolf", 0.1, 0);
  const decision = BehaviorTree.tick(agent);

  expect(decision.type).toBe("IDLE");
});

test("BehaviorTree: unknown species idles", () => {
  const agent = createAgent("unknown", 0.8, 0.8);
  const decision = BehaviorTree.tick(agent);

  expect(decision.type).toBe("IDLE");
});
