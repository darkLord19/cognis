import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "../server/persistence/database";
import { MerkleLogger } from "../server/persistence/merkle-logger";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

afterAll(() => {
  // Do not close the db singleton because other tests might run in the same process
});

test("MerkleLogger: chains entries correctly and verifyChain passes", () => {
  const branchId = "main";

  MerkleLogger.log(1, branchId, "agent_1", "System1", "health", "100", "90", null);
  MerkleLogger.log(2, branchId, "agent_1", "System2", "thought", null, "I feel pain", null);

  const result = MerkleLogger.verifyChain(branchId);
  expect(result.valid).toBe(true);

  const logs = db.getAuditLogs(branchId);
  expect(logs.length).toBe(2);
  expect(logs[1]?.previous_hash).toBe(logs[0]?.entry_hash);
});

test("MerkleLogger: logSuppression sets suppressed flag", () => {
  const branchId = "main";
  MerkleLogger.logSuppression("agent_1", branchId, "memory", "traumatic event hidden", 3);

  const logs = db.getAuditLogs(branchId);
  expect(logs.length).toBe(3);
  expect(logs[2]?.suppressed).toBe(1); // SQLite boolean

  const result = MerkleLogger.verifyChain(branchId);
  expect(result.valid).toBe(true);
});

test("MerkleLogger: verifyChain fails when entry modified", () => {
  const branchId = "main";
  const logs = db.getAuditLogs(branchId);
  const logToTamper = logs[1];
  if (!logToTamper) throw new Error("Missing log to tamper");

  // Tamper with the database
  db.db.query("UPDATE audit_log SET new_value = ? WHERE id = ?").run("I feel joy", logToTamper.id);

  const result = MerkleLogger.verifyChain(branchId);
  expect(result.valid).toBe(false);
  expect(result.error).toContain("entry hash mismatch");

  // Revert the tampering so other tests (if any) could pass
  db.db.query("UPDATE audit_log SET new_value = ? WHERE id = ?").run("I feel pain", logToTamper.id);
});

test("MerkleLogger: verifyChain fails when audit metadata is modified", () => {
  const branchId = "main";

  MerkleLogger.log(4, branchId, "agent_2", "System1", "health", "90", "80", "cause-1");

  const logs = db.getAuditLogs(branchId);
  const logToTamper = logs[logs.length - 1];
  if (!logToTamper) throw new Error("Missing log to tamper");

  db.db
    .query("UPDATE audit_log SET system = ?, cause_description = ?, suppressed = ? WHERE id = ?")
    .run("TamperedSystem", "tampered cause description", 1, logToTamper.id);

  const result = MerkleLogger.verifyChain(branchId);
  expect(result.valid).toBe(false);
  expect(result.error).toContain("entry hash mismatch");

  db.db
    .query("UPDATE audit_log SET system = ?, cause_description = ?, suppressed = ? WHERE id = ?")
    .run("System1", null, 0, logToTamper.id);
});

test("MerkleLogger: coerces object old/new values to JSON strings before DB insert", () => {
  const branchId = "main";

  MerkleLogger.log(
    5,
    branchId,
    "agent_3",
    "System2",
    "innerMonologue",
    { previous: "state", urgency: 0.2 } as unknown as string,
    { current: "state", urgency: 0.9 } as unknown as string,
    "cause-obj",
  );

  const log = db.getAuditLogs(branchId).at(-1);
  expect(log?.old_value).toBe('{"previous":"state","urgency":0.2}');
  expect(log?.new_value).toBe('{"current":"state","urgency":0.9}');
  expect(MerkleLogger.verifyChain(branchId).valid).toBe(true);
});
