import { expect, test } from "bun:test";
import { GrammarEngine } from "../server/language/grammar";

test("GrammarEngine: detectRule returns null for empty utterances", () => {
  const rule = GrammarEngine.detectRule([]);
  expect(rule).toBeNull();
});

test("GrammarEngine: detectRule returns null for single utterance", () => {
  const rule = GrammarEngine.detectRule(["grok blit"]);
  expect(rule).toBeNull();
});
