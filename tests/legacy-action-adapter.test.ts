import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import { legacyAdapter } from "../server/agents/legacy-action-adapter";

test("legacy action adapter: translates MOVE into locomotion primitive", () => {
  const plan = legacyAdapter.translate("MOVE", 10);
  expect(plan).toBeDefined();
  expect(plan?.primitives[0]?.type).toBe(ActuationType.LOCOMOTE_TOWARD);
});

test("legacy action adapter: rejects EAT during v5.2 migration", () => {
  expect(legacyAdapter.translate("EAT", 11, true)).toBeNull();
  expect(legacyAdapter.translate("EAT", 11, false)).toBeNull();
});
