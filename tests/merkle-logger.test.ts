import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "../server/persistence/database";
import { MerkleLogger } from "../server/persistence/merkle-logger";

beforeAll(() => {
  // Use a test db by replacing db via some means or just running in normal db but clearing
  // Actually, db is a singleton that connects to database.sqlite.
  // We can just wipe audit_log for testing.
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
});

afterAll(() => {
  db.close();
});

test("MerkleLogger: chains entries correctly and verifyChain passes", () => {
  const branchId = "main";

  MerkleLogger.log(1, branchId, "agent_1", "System1", "health", "100", "90", null);
  MerkleLogger.log(2, branchId, "agent_1", "System2", "thought", null, "I feel pain", null);

  const result = MerkleLogger.verifyChain(branchId);
  expect(result.valid).toBe(true);

  const logs = db.getAuditLogs(branchId);
  expect(logs.length).toBe(2);
  expect(logs[1]!.previous_hash).toBe(logs[0]!.entry_hash);
});

test("MerkleLogger: logSuppression sets suppressed flag", () => {
  const branchId = "main";
  MerkleLogger.logSuppression("agent_1", branchId, "memory", "traumatic event hidden", 3);

  const logs = db.getAuditLogs(branchId);
  expect(logs.length).toBe(3);
  expect(logs[2]!.suppressed).toBe(1); // SQLite boolean

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
