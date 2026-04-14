import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import { buildSystem2Prompt } from "../server/agents/prompt-contract";
import type { QualiaFrame } from "../server/agents/qualia-types";

const qualia: QualiaFrame = {
  agentId: "a1",
  tick: 10,
  body: [],
  world: [],
  social: [],
  urges: [],
  memories: [],
  narratableText: "A dry tightening coats your throat.",
};

test("prompt contract: includes perceptual refs and allowed actuations only", () => {
  const prompt = buildSystem2Prompt({
    qualia,
    recentMemories: ["You moved toward a salient shape."],
    semanticBeliefs: ["pattern:relief_after_swallow"],
    availablePerceptualRefs: [
      { ref: "foreground_0", kind: "visible_entity", salience: 0.9 },
      { ref: "self", kind: "self", salience: 1 },
    ],
    allowedActuations: [ActuationType.LOCOMOTE_TOWARD, ActuationType.SWALLOW],
  });

  expect(prompt).toContain("Available perceptual refs");
  expect(prompt).toContain("foreground_0");
  expect(prompt).toContain("locomote_toward");
  expect(prompt).toContain("swallow");
  expect(prompt.toLowerCase()).not.toContain("you may eat food or drink water");
});
