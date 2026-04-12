import { expect, test } from "bun:test";
import { System1 } from "../server/agents/system1";
import type { AgentState, CircadianState, WorldConfig } from "../shared/types";

const mockWorldConfig = {
  freeWill: { survivalDriveWeight: 0.6 },
} as WorldConfig;

const mockCircadian = {
  cycleHormoneValue: 0.8,
  lightLevel: 0.2,
} as CircadianState;

const createAgent = (id: string, pain: number): AgentState => {
  return {
    id,
    body: {
      hunger: 0.1,
      thirst: 0.1,
      fatigue: 0.1,
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
  } as unknown as AgentState;
};

test("System1: tick updates homeostasis and integrity drive", () => {
  const agent = createAgent("a1", 50);
  const delta = System1.tick(agent, mockCircadian, mockWorldConfig);

  expect(delta.hunger).toBeGreaterThan(0.1);
  expect(delta.cycleHormone).toBeGreaterThan(0.5); // should move toward 0.8
  expect(delta.integrityDrive).toBeGreaterThan(0);
});

test("System1: vocal actuation on high pain", () => {
  const agent = createAgent("a1", 80);
  const vocal = System1.checkVocalActuation(agent, 10);

  expect(vocal).toBeTruthy();
  expect(vocal?.soundToken).toBe("AARGH");
});

test("System1: conflict outcome based on muscle stats", () => {
  const agentA = createAgent("a", 0);
  agentA.muscleStats = { strength: 0.9, speed: 0.9, endurance: 0.9 };

  const agentB = createAgent("b", 0);
  agentB.muscleStats = { strength: 0.1, speed: 0.1, endurance: 0.1 };

  const outcome = System1.computeConflictOutcome(agentA, agentB);

  expect(outcome.damageB).toBeGreaterThan(outcome.damageA);
});
