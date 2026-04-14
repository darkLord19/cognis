import { expect, test } from "bun:test";
import { ActuationType } from "../server/agents/action-grammar";
import { checkImpossibleKnowledge } from "../server/agents/impossible-knowledge-check";
import type { System2PromptInput } from "../server/agents/prompt-contract";
import type { QualiaFrame } from "../server/agents/qualia-types";
import type { System2JsonOutput } from "../server/agents/system2-parser";
import type { LexiconEntry } from "../shared/types";

function buildPromptInput(): System2PromptInput {
  const qualia: QualiaFrame = {
    agentId: "a1",
    tick: 12,
    body: [],
    world: [],
    social: [],
    urges: [],
    memories: [],
    narratableText: "Your mouth feels rough and close.",
  };
  return {
    qualia,
    recentMemories: [],
    semanticBeliefs: [],
    availablePerceptualRefs: [{ ref: "foreground_0", kind: "visible_entity", salience: 0.8 }],
    allowedActuations: [ActuationType.LICK, ActuationType.LOCOMOTE_TOWARD],
  };
}

function buildOutput(): System2JsonOutput {
  return {
    thought: "Something ahead draws attention.",
    motorPlan: {
      primitives: [
        {
          type: ActuationType.LICK,
          target: { type: "perceptual_ref", ref: "foreground_0" },
          intensity: 0.6,
          durationTicks: 1,
        },
      ],
    },
  };
}

test("impossible knowledge: rejects operator leakage in text", () => {
  const output = buildOutput();
  output.thought = "I should target fresh_water material_id now.";
  const result = checkImpossibleKnowledge({
    output,
    promptInput: buildPromptInput(),
    lexicon: [],
  });
  expect(result.ok).toBe(false);
});

test("impossible knowledge: rejects unknown perceptual refs", () => {
  const output = buildOutput();
  const first = output.motorPlan.primitives[0];
  if (!first) {
    throw new Error("expected primitive");
  }
  first.target = { type: "perceptual_ref", ref: "foreground_9" };
  const result = checkImpossibleKnowledge({
    output,
    promptInput: buildPromptInput(),
    lexicon: [],
  });
  expect(result.ok).toBe(false);
});

test("impossible knowledge: allows lexicon-permitted concept words", () => {
  const output = buildOutput();
  output.thought = "water might help this feeling";
  const lexicon: LexiconEntry[] = [
    { word: "water", concept: "water", confidence: 0.9, consensusCount: 3 },
  ];

  const result = checkImpossibleKnowledge({
    output,
    promptInput: buildPromptInput(),
    lexicon,
  });
  expect(result.ok).toBe(true);
});
