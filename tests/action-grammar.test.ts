import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";

test("action grammar: exposes v5.2 motor primitive enum", () => {
  expect(String(ActuationType.SWALLOW)).toBe("swallow");
  expect(String(ActuationType.LOCOMOTE_TOWARD)).toBe("locomote_toward");
});
