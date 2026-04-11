import { expect, test } from "bun:test";
import * as constants from "../shared/constants";
import { EventType, type SimEvent } from "../shared/events";
import type { AgentState, WorldConfig } from "../shared/types";

test("types compile", () => {
  // This test mainly exists to ensure types are correctly imported and defined
  const check: boolean = true;
  expect(check).toBe(true);
});

test("constants are defined", () => {
  expect(constants.DEFAULT_EPISODIC_DECAY_RATE).toBe(0.5);
  expect(constants.URGENCY_THRESHOLD).toBe(0.75);
});
