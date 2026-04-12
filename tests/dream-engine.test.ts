import { beforeAll, expect, test } from "bun:test";
import { DreamEngine } from "../server/dream/dream-engine";
import { EpisodicStore } from "../server/memory/episodic-store";
import { db } from "../server/persistence/database";
import type { SimEvent } from "../shared/events";
import type { AgentState, DreamConfig, MemoryConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const dreamConfig: DreamConfig = {
  consolidationEnabled: true,
  traumaProcessingEnabled: true,
  chaosEnabled: true,
  propheticEnabled: true,
  consolidationProbability: 0.5,
  traumaProbability: 0.2,
  chaosProbability: 0.2,
  propheticProbability: 0.1,
  nightmareThreshold: 0.8,
};

const memConfig: MemoryConfig = {} as unknown as MemoryConfig;

test("DreamEngine: consolidation reifies memories", async () => {
  const agentId = "agent_dreamer";
  const branchId = "main";

  // Create a real memory
  EpisodicStore.encode(
    agentId,
    branchId,
    "I saw a bright star",
    { tick: 1, payload: { valence: 0.9, arousal: 0.9 } } as unknown as SimEvent,
    0.9,
    memConfig,
  );

  // Force a consolidation dream by setting probabilities
  const forceConsol: DreamConfig = {
    ...dreamConfig,
    consolidationProbability: 1.0,
    traumaProbability: 0,
    chaosProbability: 0,
    propheticProbability: 0,
  };

  await DreamEngine.dream(
    { id: agentId } as unknown as AgentState,
    branchId,
    forceConsol,
    memConfig,
    100,
  );

  const episodes = EpisodicStore.retrieve(agentId, branchId, 10);
  expect(episodes.some((e) => e.qualiaText.includes("Dream replay"))).toBe(true);
});

test("DreamEngine: healing reduces trauma", async () => {
  const agentId = "agent_trauma";
  const branchId = "main";
  const agent = {
    id: agentId,
    traumaFlags: [{ id: "t1", severity: 100 }],
  } as unknown as AgentState;

  const forceHealing: DreamConfig = {
    ...dreamConfig,
    consolidationProbability: 0,
    traumaProbability: 1.0,
    chaosProbability: 0,
    propheticProbability: 0,
  };

  await DreamEngine.dream(agent, branchId, forceHealing, memConfig, 101);

  expect(agent.traumaFlags![0]!.severity).toBeLessThan(100);
});
