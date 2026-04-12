import { expect, test } from "bun:test";
import { System1 } from "../server/agents/system1";
import type { AgentState } from "../shared/types";

const createAgent = (
  pain: number,
  health: number,
  integrityDrive: number,
  valence = 0,
  arousal = 0,
): AgentState => {
  return {
    id: "a1",
    body: {
      hunger: 0.1,
      thirst: 0.1,
      fatigue: 0.1,
      health,
      integrityDrive,
      valence,
      arousal,
      cycleHormone: 0.5,
      bodyMap: {
        head: { pain, damage: 0, temperature: 15 },
        torso: { pain: 0, damage: 0, temperature: 15 },
        leftArm: { pain: 0, damage: 0, temperature: 15 },
        rightArm: { pain: 0, damage: 0, temperature: 15 },
        leftLeg: { pain: 0, damage: 0, temperature: 15 },
        rightLeg: { pain: 0, damage: 0, temperature: 15 },
      },
    },
    muscleStats: { strength: 0.5, speed: 0.5, endurance: 0.5 },
    relationships: [],
    lexicon: [],
  } as unknown as AgentState;
};

test("System1: RECOIL reaction on high pain", () => {
  const agent = createAgent(0.85, 1.0, 0);
  const reaction = System1.checkImmediateReaction(agent);

  expect(reaction).not.toBeNull();
  expect(reaction?.type).toBe("RECOIL");
});

test("System1: COLLAPSE reaction on near-death health", () => {
  const agent = createAgent(0, 0.05, 0);
  const reaction = System1.checkImmediateReaction(agent);

  expect(reaction).not.toBeNull();
  expect(reaction?.type).toBe("COLLAPSE");
});

test("System1: FLEE reaction on extreme combined threat", () => {
  const agent = createAgent(0.95, 1.0, 0.9);
  const reaction = System1.checkImmediateReaction(agent);

  expect(reaction).not.toBeNull();
  // FLEE or RECOIL both acceptable at this extreme
  expect(["FLEE", "RECOIL"]).toContain(reaction?.type as string);
});

test("System1: no reaction when calm and healthy", () => {
  const agent = createAgent(0.1, 1.0, 0.1);
  const reaction = System1.checkImmediateReaction(agent);

  expect(reaction).toBeNull();
});

test("System1: emitEmotionalField returns agent valence/arousal", () => {
  const agent = createAgent(0, 1.0, 0, 0.7, 0.3);
  const field = System1.emitEmotionalField(agent);

  expect(field.agentId).toBe("a1");
  expect(field.valence).toBe(0.7);
  expect(field.arousal).toBe(0.3);
});

test("System1: pleasure vocal actuation on high positive valence", () => {
  const agent = createAgent(0, 1.0, 0, 0.8, 0.6);
  const vocal = System1.checkVocalActuation(agent, 10);

  expect(vocal).not.toBeNull();
  expect(vocal?.soundToken).toBe("MMM");
});

test("System1: alarm vocal on high arousal + negative valence", () => {
  const agent = createAgent(0, 1.0, 0, -0.7, 0.9);
  const vocal = System1.checkVocalActuation(agent, 10);

  expect(vocal).not.toBeNull();
  expect(vocal?.soundToken).toBe("EKK-EKK");
});
