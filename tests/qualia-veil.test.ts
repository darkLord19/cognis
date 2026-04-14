import { expect, test } from "bun:test";
import type { QualiaSegment } from "../server/agents/qualia-types";
import { validateQualiaOutput } from "../server/agents/qualia-validator";
import { applySapirWhorfGate, enforceQualiaVeil } from "../server/agents/qualia-veil";

test("qualia veil: strips forbidden substrate terms", () => {
  const cleaned = enforceQualiaVeil("you detect simulation code at tick 20");
  expect(cleaned).not.toMatch(/\bsimulation\b/i);
  expect(cleaned).not.toMatch(/\bcode\b/i);
  expect(cleaned).not.toMatch(/\btick\b/i);
});

test("qualia veil: applies sapir-whorf gate when lexicon lacks concepts", () => {
  const segments: QualiaSegment[] = [
    {
      channel: "urge",
      band: "prominent",
      text: "you need to drink water now",
      conceptTags: [],
    },
  ];
  const gated = applySapirWhorfGate(segments, []);
  expect(gated[0]?.text).not.toMatch(/\bwater\b/i);
  expect(gated[0]?.text).not.toMatch(/\bdrink\b/i);
});

test("qualia validator: rejects spoiler concepts without lexicon support", () => {
  const result = validateQualiaOutput("you are thirsty and need water", []);
  expect(result.valid).toBe(false);
  expect(result.violations.length).toBeGreaterThan(0);
});
