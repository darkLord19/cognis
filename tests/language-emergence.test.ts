import { expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { LanguageEmergence } from "../server/language/emergence";
import type { AgentState, VocalActuation, Voxel } from "../shared/types";

test("LanguageEmergence: proto-word coined after 5 co-occurrences", () => {
  const bus = new EventBus();

  const listener = { id: "l1" } as unknown as AgentState;
  const actuation: VocalActuation = {
    emitterId: "e1",
    soundToken: "FIRE-HOT",
    arousal: 0.9,
    valence: -0.5,
    tick: 10,
  };
  const nearbyVoxels: Voxel[] = [
    { type: 8, material: "fire", temperature: 100, moisture: 0, fertility: 0, lightLevel: 1 },
  ];

  let coined = false;
  bus.onAny((e) => {
    if (e.type === "proto_word_coined") coined = true;
  });

  // Process 5 times
  for (let i = 0; i < 5; i++) {
    LanguageEmergence.processVocalActuation(actuation, [listener], nearbyVoxels, "main", bus);
  }

  expect(coined).toBe(true);
});

test("LanguageEmergence: promotion to lexicon", () => {
  const bus = new EventBus();
  const agent = { id: "a1", lexicon: [] } as unknown as AgentState;

  LanguageEmergence.promoteToLexicon(agent, "WOOF", "dog", "main", bus);

  expect(agent.lexicon.length).toBe(1);
  expect(agent.lexicon[0]?.word).toBe("WOOF");
});
