import { expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { JournalingSystem } from "../server/world/journaling";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { AgentState } from "../shared/types";

test("JournalingSystem: marks and recovers meaning based on overlap", () => {
  const bus = new EventBus();
  const journal = new JournalingSystem(bus);
  const grid = new VoxelGrid(3, 3, 3);

  grid.set(1, 1, 1, {
    type: 1,
    material: "stone",
    temperature: 20,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });

  let marked = false;
  bus.onAny(() => (marked = true));

  journal.markVoxel("agent_1", 1, 1, 1, "hello world", "pidgin", 100, grid);
  expect(marked).toBe(true);

  const v = grid.get(1, 1, 1);
  expect(v?.metadata?.markings?.length).toBe(1);

  // Agent knows both
  const agentFull = { lexicon: [{ word: "hello" }, { word: "world" }] } as unknown as AgentState;
  const discFull = journal.discoverMarking(agentFull, 1, 1, 1, grid);
  expect(discFull?.status).toBe("full");

  // Agent knows one
  const agentPartial = { lexicon: [{ word: "hello" }] } as unknown as AgentState;
  const discPartial = journal.discoverMarking(agentPartial, 1, 1, 1, grid);
  expect(discPartial?.status).toBe("partial");

  // Agent knows none
  const agentNone = { lexicon: [{ word: "apple" }] } as unknown as AgentState;
  const discNone = journal.discoverMarking(agentNone, 1, 1, 1, grid);
  expect(discNone?.status).toBe("none");
});
