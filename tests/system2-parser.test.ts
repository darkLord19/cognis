import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import { parseSystem2Output } from "../server/agents/system2-parser";

test("system2 parser: parses strict JSON output with fence wrapper", () => {
  const result = parseSystem2Output(`\`\`\`json
{
  "thought": "A sharp bitter trace lingers.",
  "motorPlan": {
    "primitives": [
      {
        "type": "lick",
        "target": { "type": "perceptual_ref", "ref": "foreground_0" },
        "intensity": 0.7,
        "durationTicks": 2
      }
    ]
  }
}
\`\`\``);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.motorPlan.primitives[0]?.type).toBe(ActuationType.LICK);
  expect(result.value.motorPlan.primitives[0]?.target).toEqual({
    type: "perceptual_ref",
    ref: "foreground_0",
  });
});

test("system2 parser: rejects invalid JSON payload", () => {
  const result = parseSystem2Output("thought: move front");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe("invalid_json");
});

test("system2 parser: rejects symbolic action types", () => {
  const result = parseSystem2Output(`{
    "thought": "I should do the old thing",
    "motorPlan": { "primitives": [ { "type": "EAT", "target": { "type": "none" }, "intensity": 1, "durationTicks": 1 } ] }
  }`);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe("invalid_primitive");
});
