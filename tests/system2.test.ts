import { beforeAll, expect, test } from "bun:test";
import { System2 } from "../server/agents/system2";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import type { AgentState, FilteredPercept, WorldConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const mockWorldConfig = {
  semanticMasking: { enabled: false },
} as WorldConfig;

test("System2: think calls LLM and logs monologue with qualia causal link", async () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const agent = {
    id: "a1",
    name: "Bob",
    relationships: [],
    body: { integrityDrive: 0.1 },
  } as unknown as AgentState;
  const percept = {
    primaryAttention: [],
    peripheralAwareness: { count: 0 },
    focusedVoxels: [],
    ownBody: {},
  } as unknown as FilteredPercept;

  const output = await system2.think(agent, "I see a rock.", percept, mockWorldConfig, 10, "main", {
    causal: {
      qualiaPacketId: "qualia-packet-1",
      sourceTick: 10,
    },
  });

  expect(output.innerMonologue).toBeTruthy();

  // Check audit log for innerMonologue
  const logs = db.getAuditLogs("main");
  const monologueLog = logs.find((l) => l.field === "innerMonologue");
  expect(monologueLog).toBeTruthy();
  expect(monologueLog?.new_value).toBe(output.innerMonologue);
  expect(monologueLog?.cause_event_id).toBe("qualia-packet-1");
  expect(monologueLog?.cause_description).toContain("source_tick=10");
});

test("System2: shouldFire on integrity drive jump", () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const agent = { body: { integrityDrive: 0.1 } } as unknown as AgentState;
  const bodyDelta = { previousIntegrityDrive: 0.1, currentIntegrityDrive: 0.41 };

  const percept = {} as FilteredPercept;

  const originalRandom = Math.random;
  Math.random = () => 1;
  try {
    expect(system2.shouldFire(agent, bodyDelta, percept, mockWorldConfig)).toBe(true);
  } finally {
    Math.random = originalRandom;
  }
});

test("System2: shouldFire does not double-count absolute integrity values", () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const agent = { body: { integrityDrive: 0.3 } } as unknown as AgentState;
  const bodyDelta = {
    integrityDrive: 0.3,
    previousIntegrityDrive: 0.3,
    currentIntegrityDrive: 0.3,
  };

  const percept = {} as FilteredPercept;

  const originalRandom = Math.random;
  Math.random = () => 1;
  try {
    expect(system2.shouldFire(agent, bodyDelta, percept, mockWorldConfig)).toBe(false);
  } finally {
    Math.random = originalRandom;
  }
});

test("System2: think prompt does not leak other agent names or IDs", async () => {
  let capturedPrompt = "";
  const capturingProvider = {
    completion: async (prompt: string) => {
      capturedPrompt = prompt;
      return `{"innerMonologue":"ok","decision":{"type":"IDLE"}}`;
    },
    embed: async () => [],
  };
  const gateway = new LLMGateway(capturingProvider);
  const system2 = new System2(gateway);

  const agent = {
    id: "a1",
    name: "Observer",
    relationships: [
      {
        targetAgentId: "a2",
        affinity: 0.5,
        trust: 0.3,
        fear: 0.1,
        significantEvents: ["saw near river"],
      },
    ],
    body: { integrityDrive: 0.1 },
  } as unknown as AgentState;

  const percept = {
    primaryAttention: [
      {
        id: "a2",
        name: "Human 4",
        body: { arousal: 0.2, valence: 0.2 },
      },
    ],
    peripheralAwareness: { count: 0 },
    focusedVoxels: [],
    ownBody: {},
  } as unknown as FilteredPercept;

  await system2.think(
    agent,
    "A familiar presence is nearby.",
    percept,
    mockWorldConfig,
    10,
    "main",
  );

  expect(capturedPrompt).not.toContain("Human 4");
  expect(capturedPrompt).not.toContain("a2");
});

test("System2: strips intentional communicate decisions and utterances", async () => {
  const provider = {
    completion: async () =>
      `{"innerMonologue":"pulse rising","decision":{"type":"COMMUNICATE"},"utterance":"hello"}`,
    embed: async () => [],
  };
  const gateway = new LLMGateway(provider);
  const system2 = new System2(gateway);

  const agent = {
    id: "a1",
    relationships: [],
    body: { integrityDrive: 0.1 },
  } as unknown as AgentState;
  const percept = {
    primaryAttention: [],
    peripheralAwareness: { count: 0 },
    focusedVoxels: [],
    ownBody: {},
  } as unknown as FilteredPercept;

  const output = await system2.think(
    agent,
    "interoceptive_map(...)",
    percept,
    mockWorldConfig,
    10,
    "main",
  );

  expect(output.decision.type).toBe("IDLE");
  expect(output.utterance).toBeUndefined();
});
