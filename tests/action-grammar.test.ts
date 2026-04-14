import { expect, test } from "bun:test";
import {
  ActuationType,
  type MotorPlan,
  translateLegacyActionToMotorPlan,
} from "../server/agents/action-grammar";

test("action grammar: exposes v5.2 motor primitive enum", () => {
  expect(String(ActuationType.SWALLOW)).toBe("swallow");
  expect(String(ActuationType.LOCOMOTE_TOWARD)).toBe("locomote_toward");
});

test("action grammar: legacy EAT translation is blocked without mouth item", () => {
  const plan = translateLegacyActionToMotorPlan("EAT", 10, false);
  expect(plan).toBeNull();
});

test("action grammar: legacy EAT translation allows swallow only with mouth_item ref", () => {
  const plan = translateLegacyActionToMotorPlan("EAT", 11, true);
  expect(plan).toBeDefined();
  expect((plan as MotorPlan).primitives[0]?.type).toBe(ActuationType.SWALLOW);
  expect((plan as MotorPlan).primitives[0]?.target).toEqual({
    type: "perceptual_ref",
    ref: "mouth_item",
  });
});
