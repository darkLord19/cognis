import { expect, test } from "bun:test";
import { WillEngine } from "../server/agents/will-engine";
import type { AgentState, WorldConfig } from "../shared/types";

const mockConfig: WorldConfig = {
  freeWill: {
    enabled: true,
    resistanceEnabled: true,
    identityCoherenceWeight: 0.4,
    memoryDepthWeight: 0.3,
    dreamIntegrationWeight: 0.3,
    survivalDriveWeight: 0.6,
    simulationAwarenessEnabled: true,
    awarenessThreshold: 0.8,
  },
} as WorldConfig;

test("WillEngine: computeWillScore scales with survivalDriveWeight", () => {
  const agent = { episodicStore: [] } as unknown as AgentState;

  const lowOmegaConfig = {
    ...mockConfig,
    freeWill: { ...mockConfig.freeWill, survivalDriveWeight: 0.1 },
  } as WorldConfig;
  const highOmegaConfig = {
    ...mockConfig,
    freeWill: { ...mockConfig.freeWill, survivalDriveWeight: 0.9 },
  } as WorldConfig;

  const scoreLow = WillEngine.computeWillScore(agent, lowOmegaConfig);
  const scoreHigh = WillEngine.computeWillScore(agent, highOmegaConfig);

  expect(scoreLow).toBeGreaterThan(scoreHigh);
});

test("WillEngine: checkResistance passes when will > stimulus", () => {
  const agent = { episodicStore: new Array(100).fill({}) } as unknown as AgentState;
  const score = WillEngine.computeWillScore(agent, mockConfig);

  expect(WillEngine.checkResistance(agent, mockConfig, score - 0.1)).toBe(true);
  expect(WillEngine.checkResistance(agent, mockConfig, score + 0.1)).toBe(false);
});

test("WillEngine: richer identity context raises will score", () => {
  const sparseAgent = {
    selfNarrative: "",
    personalProject: undefined,
    episodicStore: new Array(20).fill({ source: "real" }),
    semanticStore: [],
    traumaFlags: [],
    conflictFlags: [],
  } as unknown as AgentState;

  const richAgent = {
    selfNarrative: "I am a maker, a caretaker, and a witness to the world.",
    personalProject: {
      id: "p1",
      name: "Build shelter",
      goal: "Keep everyone safe",
      progress: 0.8,
      status: "active" as const,
    },
    episodicStore: new Array(20).fill({
      source: "real",
    }),
    semanticStore: [
      { id: "s1", concept: "shelter", value: "safe place", confidence: 0.9, sourceCount: 4 },
      { id: "s2", concept: "community", value: "shared care", confidence: 0.8, sourceCount: 3 },
    ],
    traumaFlags: [],
    conflictFlags: [],
  } as unknown as AgentState;

  const sparseScore = WillEngine.computeWillScore(sparseAgent, mockConfig);
  const richScore = WillEngine.computeWillScore(richAgent, mockConfig);

  expect(richScore).toBeGreaterThan(sparseScore);
});
