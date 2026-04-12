import { expect, test } from "bun:test";
import { DecayEngine } from "../server/memory/decay-engine";
import type { AgentState, MemoryConfig } from "../shared/types";

const config: MemoryConfig = {
  episodicDecayRate: 0.1,
  episodicCapacity: 100,
  patternSeparation: true,
  semanticDecayRate: 0.05,
  semanticCapacity: 1000,
  consistencyThreshold: 0.5,
  catastrophicInterferenceEnabled: true,
  neSignalEnabled: true,
  neDecayRate: 0.1,
  neLockDuration: 10,
  consolidationPassesPerSleep: 1,
  traumaDistortionEnabled: true,
  rehearsalResetsDecay: true,
  motivatedForgettingEnabled: true,
  suppressionDecayRate: 0.5,
  contextualForgettingEnabled: true,
  inheritanceEnabled: false,
  inheritableFraction: 0,
};

const createAgent = (): AgentState => {
  return {
    id: "a1",
    feelingResidues: [
      { id: "r1", tick: 1, valence: 0.8, arousal: 0.6, sourceEventId: "e1" },
      { id: "r2", tick: 2, valence: 0.02, arousal: 0.02, sourceEventId: "e2" },
    ],
    body: {},
  } as unknown as AgentState;
};

test("DecayEngine: tickAll decays feeling residues", () => {
  const agent = createAgent();
  DecayEngine.tickAll([agent], "main", config, 100);

  const r1 = agent.feelingResidues.find((r) => r.id === "r1");
  expect(r1?.valence).toBeLessThan(0.8);
});

test("DecayEngine: tickAll removes residues below threshold", () => {
  const agent = createAgent();
  DecayEngine.tickAll([agent], "main", config, 100);

  // r2 started at 0.02/0.02, should be removed after decay
  const r2 = agent.feelingResidues.find((r) => r.id === "r2");
  expect(r2).toBeUndefined();
});

test("DecayEngine: handles agents with no residues", () => {
  const agent = createAgent();
  agent.feelingResidues = [];

  // Should not throw
  DecayEngine.tickAll([agent], "main", config, 100);
  expect(agent.feelingResidues.length).toBe(0);
});
