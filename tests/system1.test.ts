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
  const agent = createAgent("a1", 0.5);
  const delta = System1.tick(agent, mockCircadian, mockWorldConfig);

  expect(delta.hunger).toBeGreaterThan(0.1);
  expect(delta.cycleHormone).toBeGreaterThan(0.5); // should move toward 0.8
  expect(delta.integrityDrive).toBeGreaterThan(0);
});

test("System1: vocal actuation on high pain", () => {
  const agent = createAgent("a1", 0.8);
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

test("System1: starvation drains health and marks death when health reaches zero", () => {
  const agent = createAgent("a1", 0);
  agent.body.hunger = 0.95;
  agent.body.health = 0.002;

  const delta = System1.tick(agent, mockCircadian, mockWorldConfig);

  expect(delta.health).toBe(0);
  expect(delta.shouldDie).toBe(true);
});

test("System1: integrity drive follows omega * (hunger + pain + threat)", () => {
  const baseAgent = createAgent("a1", 0.4);
  baseAgent.body.hunger = 0.5;
  baseAgent.body.thirst = 0.3;
  baseAgent.body.health = 0.7;
  baseAgent.body.coreTemperature = 5;

  const lowOmega = {
    freeWill: { survivalDriveWeight: 0.5 },
  } as WorldConfig;
  const highOmega = {
    freeWill: { survivalDriveWeight: 1.0 },
  } as WorldConfig;

  const low = System1.tick(structuredClone(baseAgent), mockCircadian, lowOmega).integrityDrive ?? 0;
  const high =
    System1.tick(structuredClone(baseAgent), mockCircadian, highOmega).integrityDrive ?? 0;

  expect(high).toBeGreaterThan(low);
  expect(high).toBeLessThanOrEqual(1);
});

test("System1: conflict outcome follows strength over defender speed+endurance", () => {
  const attacker = createAgent("attacker", 0);
  attacker.muscleStats = { strength: 0.9, speed: 0.4, endurance: 0.4 };

  const defender = createAgent("defender", 0);
  defender.muscleStats = { strength: 0.2, speed: 0.6, endurance: 0.3 };

  const outcome = System1.computeConflictOutcome(attacker, defender, 1);
  const expectedDamageToDefender = 0.9 / (0.6 + 0.3);
  const expectedDamageToAttacker = 0.2 / (0.4 + 0.4);

  expect(outcome.damageB).toBeCloseTo(expectedDamageToDefender, 5);
  expect(outcome.damageA).toBeCloseTo(expectedDamageToAttacker, 5);
});

test("System1: consuming biomass reduces integrity pressure", () => {
  const agent = createAgent("a1", 0.2);
  agent.body.hunger = 0.9;
  agent.currentAction = "EAT";

  const withoutBiomass =
    System1.tick(structuredClone(agent), mockCircadian, mockWorldConfig).integrityDrive ?? 0;
  const withBiomass =
    System1.tick(structuredClone(agent), mockCircadian, mockWorldConfig, {
      localMaterial: "biomass",
      biomassAvailable: 1,
    }).integrityDrive ?? 0;

  expect(withBiomass).toBeLessThan(withoutBiomass);
});
