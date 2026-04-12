import { expect, test } from "bun:test";
import { EmotionalField } from "../server/perception/emotional-field";
import type { AgentState } from "../shared/types";

const createAgent = (id: string, valence: number, arousal: number): AgentState => {
  return {
    id,
    body: {
      valence,
      arousal,
      bodyMap: {
        head: { pain: 0, damage: 0, temperature: 15 },
        torso: { pain: 0, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
    },
    relationships: [],
  } as unknown as AgentState;
};

test("EmotionalField: detects emotional fields from nearby agents", () => {
  const observer = createAgent("obs", 0.5, 0.5);
  const other = createAgent("other1", -0.8, 0.7);

  const detections = EmotionalField.detectFields(observer, [other], 1, "main");

  expect(detections.length).toBe(1);
  expect(detections[0]?.valenceImpression).toBe(-0.8);
  expect(detections[0]?.arousalImpression).toBe(0.7);
});

test("EmotionalField: suppresses zero-field agents and logs to audit", () => {
  const observer = createAgent("obs", 0.5, 0.5);
  const suppressed = createAgent("sup", 0, 0); // zero valence + arousal = suppressed

  const detections = EmotionalField.detectFields(observer, [suppressed], 1, "main");

  expect(detections.length).toBe(0); // suppressed field not returned
});

test("EmotionalField: skips self in detection", () => {
  const agent = createAgent("self", 0.5, 0.5);

  const detections = EmotionalField.detectFields(agent, [agent], 1, "main");

  expect(detections.length).toBe(0);
});

test("EmotionalField: handles multiple nearby agents", () => {
  const observer = createAgent("obs", 0, 0);
  const a = createAgent("a", 0.3, 0.4);
  const b = createAgent("b", -0.6, 0.9);

  const detections = EmotionalField.detectFields(observer, [a, b], 1, "main");

  expect(detections.length).toBe(2);
});
