import { expect, test } from "bun:test";
import { BehaviorTree } from "../server/species/behavior-tree";
import type { AgentState, FilteredPercept } from "../shared/types";

const createAgent = (
  speciesId: string,
  hunger: number,
  integrityDrive: number,
  overrides: Partial<AgentState["body"]> = {},
): AgentState => {
  return {
    id: "a1",
    speciesId,
    body: { hunger, integrityDrive, health: 1, fatigue: 0, ...overrides },
    position: { x: 0, y: 0, z: 0 },
  } as unknown as AgentState;
};

const emptyPercept = {
  primaryAttention: [],
  peripheralAwareness: { count: 0, aggregateEmotionalField: 0 },
  focusedVoxels: [],
  ownBody: {},
} as unknown as FilteredPercept;

test("BehaviorTree: wolf hunts when hungry", () => {
  const agent = createAgent("wolf", 0.8, 0);
  const decision = BehaviorTree.tick(agent, emptyPercept);

  expect(decision.type).toBe("WANDER");
  expect(decision.params?.radius).toBe(20);
});

test("BehaviorTree: deer flees on high integrity drive", () => {
  const agent = createAgent("deer", 0, 0.8);
  const decision = BehaviorTree.tick(agent, emptyPercept);

  expect(decision.type).toBe("MOVE");
  expect(decision.params?.goal).toBe("flee");
});

test("BehaviorTree: wolf idles when not hungry", () => {
  const agent = createAgent("wolf", 0.1, 0);
  const decision = BehaviorTree.tick(agent, emptyPercept);

  expect(decision.type).toBe("WANDER");
});

test("BehaviorTree: unknown species idles", () => {
  const agent = createAgent("unknown", 0.8, 0.8);
  const decision = BehaviorTree.tick(agent, emptyPercept);

  expect(decision.type).toBe("IDLE");
});

test("BehaviorTree: wolf rests when exhausted", () => {
  const agent = createAgent("wolf", 0.4, 0, { fatigue: 0.95 });
  const decision = BehaviorTree.tick(agent, emptyPercept);

  expect(decision.type).toBe("REST");
});

test("BehaviorTree: wolf attacks visible prey at close range", () => {
  const agent = createAgent("wolf", 0.8, 0);
  const percept = {
    ...emptyPercept,
    primaryAttention: [
      {
        id: "deer-1",
        speciesId: "deer",
        position: { x: 1, y: 0, z: 1 },
      },
    ],
  } as unknown as FilteredPercept;
  const decision = BehaviorTree.tick(agent, percept);

  expect(decision.type).toBe("ATTACK");
  expect(decision.targetId).toBe("deer-1");
});
