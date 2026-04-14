import { expect, test } from "bun:test";
import { EventType } from "../shared/events";

test("v5.2: event enum includes reflex and sensor events", () => {
  expect(String(EventType.SENSOR_THRESHOLD_CROSSED)).toBe("sensor_threshold_crossed");
  expect(String(EventType.REFLEX_FIRED)).toBe("reflex_fired");
});

test("v5.2: event enum includes veil and impossible-knowledge guards", () => {
  expect(String(EventType.VEIL_BREACH)).toBe("veil_breach");
  expect(String(EventType.IMPOSSIBLE_KNOWLEDGE_REJECTED)).toBe("impossible_knowledge_rejected");
});

test("v5.2: existing action events remain intact", () => {
  expect(String(EventType.ACTION_ATTEMPTED)).toBe("action_attempted");
  expect(String(EventType.ACTION_SUCCEEDED)).toBe("action_succeeded");
  expect(String(EventType.ACTION_FAILED)).toBe("action_failed");
});
