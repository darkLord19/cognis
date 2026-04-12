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

test("System2: think calls LLM and logs monologue to MerkleLogger", async () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const agent = { id: "a1", name: "Bob", relationships: [] } as unknown as AgentState;
  const percept = {
    primaryAttention: [],
    peripheralAwareness: { count: 0 },
    focusedVoxels: [],
    ownBody: {},
  } as unknown as FilteredPercept;

  const output = await system2.think(agent, "I see a rock.", percept, mockWorldConfig, 10, "main");

  expect(output.innerMonologue).toBeTruthy();

  // Check audit log for innerMonologue
  const logs = db.getAuditLogs("main");
  const monologueLog = logs.find((l) => l.field === "innerMonologue");
  expect(monologueLog).toBeTruthy();
  expect(monologueLog!.new_value).toBe(output.innerMonologue);
});

test("System2: shouldFire on integrity drive jump", () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const system2 = new System2(gateway);

  const agent = { body: { integrityDrive: 0.1 } } as unknown as AgentState;
  const bodyDelta = { integrityDrive: 0.3 }; // Jump of 0.3 > 0.2 threshold

  const percept = {} as FilteredPercept;

  expect(system2.shouldFire(agent, bodyDelta, percept, mockWorldConfig)).toBe(true);
});
