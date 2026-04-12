import { beforeEach, expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { LanguageEmergence } from "../server/language/emergence";
import type { AgentState, VocalActuation, Voxel } from "../shared/types";

beforeEach(() => {
  LanguageEmergence.reset();
});

const createAgent = (id: string): AgentState => {
  return {
    id,
    lexicon: [],
    relationships: [],
    body: { valence: 0, arousal: 0 },
  } as unknown as AgentState;
};

const makeVoxel = (material: string): Voxel => {
  return { position: { x: 0, y: 0, z: 0 }, material, temperature: 15 } as unknown as Voxel;
};

const makeActuation = (emitterId: string, token: string): VocalActuation => ({
  emitterId,
  soundToken: token,
  arousal: 0.5,
  valence: -0.5,
  tick: 1,
});

test("LanguageEmergence: promoteToLexicon fails without consensus", () => {
  const agent = createAgent("a1");
  const eventBus = new EventBus();

  // Only 1 agent has coined the proto-word — below consensus threshold of 3
  const result = LanguageEmergence.promoteToLexicon(agent, "grok", "fire", "main", eventBus);

  expect(result).toBe(false);
  expect(agent.lexicon.length).toBe(0);
});

test("LanguageEmergence: promoteToLexicon succeeds with 3-agent consensus", () => {
  const eventBus = new EventBus();
  const voxels = [makeVoxel("fire")];

  // 3 agents each hear "grok" near fire 5 times (PROTO_WORD_COOCCURRENCE_THRESHOLD)
  for (const agentId of ["a1", "a2", "a3"]) {
    for (let i = 0; i < 5; i++) {
      const actuation = makeActuation("emitter", "grok");
      LanguageEmergence.processVocalActuation(
        actuation,
        [createAgent(agentId)],
        voxels,
        "main",
        eventBus,
      );
    }
  }

  // Now consensus is met — promotion should succeed
  const agent = createAgent("a1");
  const result = LanguageEmergence.promoteToLexicon(agent, "grok", "fire", "main", eventBus);

  expect(result).toBe(true);
  expect(agent.lexicon.length).toBe(1);
  expect(agent.lexicon[0]?.word).toBe("grok");
  expect(agent.lexicon[0]?.consensusCount).toBe(3);
});

test("LanguageEmergence: promoteToLexicon fails with only 2 agents", () => {
  const eventBus = new EventBus();
  const voxels = [makeVoxel("fire")];

  // Only 2 agents — below threshold
  for (const agentId of ["a1", "a2"]) {
    for (let i = 0; i < 5; i++) {
      const actuation = makeActuation("emitter", "grok");
      LanguageEmergence.processVocalActuation(
        actuation,
        [createAgent(agentId)],
        voxels,
        "main",
        eventBus,
      );
    }
  }

  const agent = createAgent("a1");
  const result = LanguageEmergence.promoteToLexicon(agent, "grok", "fire", "main", eventBus);

  expect(result).toBe(false);
  expect(agent.lexicon.length).toBe(0);
});

test("LanguageEmergence: hasConsensus returns correct state", () => {
  const eventBus = new EventBus();
  const voxels = [makeVoxel("fire")];

  // Before consensus
  expect(LanguageEmergence.hasConsensus("grok", "fire")).toBe(false);

  // Build consensus with 3 agents
  for (const agentId of ["a1", "a2", "a3"]) {
    for (let i = 0; i < 5; i++) {
      LanguageEmergence.processVocalActuation(
        makeActuation("emitter", "grok"),
        [createAgent(agentId)],
        voxels,
        "main",
        eventBus,
      );
    }
  }

  expect(LanguageEmergence.hasConsensus("grok", "fire")).toBe(true);
});

test("LanguageEmergence: getConsensusWords returns achieved words", () => {
  const eventBus = new EventBus();
  const voxels = [makeVoxel("fire")];

  for (const agentId of ["a1", "a2", "a3"]) {
    for (let i = 0; i < 5; i++) {
      LanguageEmergence.processVocalActuation(
        makeActuation("emitter", "grok"),
        [createAgent(agentId)],
        voxels,
        "main",
        eventBus,
      );
    }
  }

  const words = LanguageEmergence.getConsensusWords();
  expect(words.length).toBe(1);
  expect(words[0]?.token).toBe("grok");
  expect(words[0]?.referent).toBe("fire");
  expect(words[0]?.agentCount).toBe(3);
});

test("LanguageEmergence: duplicate promotion is idempotent", () => {
  const eventBus = new EventBus();
  const voxels = [makeVoxel("fire")];

  for (const agentId of ["a1", "a2", "a3"]) {
    for (let i = 0; i < 5; i++) {
      LanguageEmergence.processVocalActuation(
        makeActuation("emitter", "grok"),
        [createAgent(agentId)],
        voxels,
        "main",
        eventBus,
      );
    }
  }

  const agent = createAgent("a1");
  LanguageEmergence.promoteToLexicon(agent, "grok", "fire", "main", eventBus);
  const secondResult = LanguageEmergence.promoteToLexicon(agent, "grok", "fire", "main", eventBus);

  expect(secondResult).toBe(false); // already in lexicon
  expect(agent.lexicon.length).toBe(1);
});
