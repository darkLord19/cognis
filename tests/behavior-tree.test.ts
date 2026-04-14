import { expect, test } from "bun:test";
import { BehaviorTree } from "../server/species/behavior-tree";
import type { AgentState, FilteredPercept } from "../shared/types";

const createAgent = (speciesId: string): AgentState =>
  ({
    speciesId,
    body: {
      energy: 1.0,
      health: 1.0,
      fatigue: 0,
      integrityDrive: 0,
    },
    position: { x: 0, y: 0, z: 0 },
  }) as unknown as AgentState;

test("BehaviorTree: wolf hunts when hungry", () => {
  const agent = createAgent("wolf");
  agent.body.energy = 0.4; // hungry

  const percept: FilteredPercept = {
    primaryAttention: [{ id: "deer-1", speciesId: "deer", position: { x: 10, y: 0, z: 0 } }],
    focusedVoxels: [],
  } as unknown as FilteredPercept;

  const decision = BehaviorTree.tick(agent, percept);
  expect(decision.type).toBe("MOVE");
});

test("BehaviorTree: deer flees on high integrity drive", () => {
  const agent = createAgent("deer");
  agent.body.integrityDrive = 0.6;

  const decision = BehaviorTree.tick(agent);
  expect(decision.type).toBe("MOVE");
});

test("BehaviorTree: wolf idles when not hungry", () => {
  const agent = createAgent("wolf");
  agent.body.energy = 0.9;

  const decision = BehaviorTree.tick(agent);
  expect(decision.type).toBe("TURN"); // wolf turns randomly when not hungry in our new BT
});

test("BehaviorTree: unknown species idles", () => {
  const agent = createAgent("alien");
  const decision = BehaviorTree.tick(agent);
  expect(decision.type).toBe("DEFER");
});

test("BehaviorTree: wolf rests when exhausted", () => {
  const agent = createAgent("wolf");
  agent.body.fatigue = 0.9;

  const decision = BehaviorTree.tick(agent);
  expect(decision.type).toBe("REST");
});

test("BehaviorTree: wolf attacks visible prey at close range", () => {
  const agent = createAgent("wolf");
  agent.body.energy = 0.4;

  const percept: FilteredPercept = {
    primaryAttention: [{ id: "deer-1", speciesId: "deer", position: { x: 1, y: 0, z: 0 } }],
    focusedVoxels: [],
  } as unknown as FilteredPercept;

  const decision = BehaviorTree.tick(agent, percept);
  expect(decision.type).toBe("INGEST_ATTEMPT");
});
