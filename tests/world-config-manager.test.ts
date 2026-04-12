import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BranchManager } from "../server/core/branch-manager";
import { RunManager } from "../server/core/run-manager";
import { WorldConfigManager } from "../server/core/world-config-manager";
import { db } from "../server/persistence/database";
import { MerkleLogger } from "../server/persistence/merkle-logger";
import type { WorldConfig } from "../shared/types";

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM config_mutations");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("DELETE FROM runs");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

function loadTemplate(): WorldConfig {
  return JSON.parse(readFileSync("./data/world-configs/earth-default.json", "utf8")) as WorldConfig;
}

test("WorldConfigManager: persists canonical config snapshots in runs", () => {
  const runId = "run-config";
  const config = loadTemplate();

  RunManager.createRun(runId, config.meta.name, 0);
  WorldConfigManager.create(config, runId, db);

  const loaded = WorldConfigManager.load(runId, "main", 0, db);
  const run = RunManager.getRun(runId);

  expect(loaded).toEqual(config);
  expect(run?.world_config).toBeTruthy();
  expect(WorldConfigManager.verify(runId, db)).toBe(true);
});

test("WorldConfigManager: reconstructs config from base snapshot plus mutations", () => {
  const runId = "run-config-mutate";
  const branchId = "main";
  const config = loadTemplate();

  RunManager.createRun(runId, config.meta.name, 0);
  BranchManager.createBranch(branchId, "main", 0);
  WorldConfigManager.create(config, runId, db);

  WorldConfigManager.mutate(runId, branchId, 10, "physics.gravity", 3.7, db, MerkleLogger);

  const beforeMutation = WorldConfigManager.load(runId, branchId, 5, db);
  const afterMutation = WorldConfigManager.load(runId, branchId, 10, db);
  const mutation = db.db
    .query("SELECT * FROM config_mutations WHERE branch_id = ? ORDER BY id ASC")
    .get(branchId) as Record<string, unknown> | null;

  expect(beforeMutation.physics.gravity).toBe(config.physics.gravity);
  expect(afterMutation.physics.gravity).toBe(3.7);
  expect(mutation?.old_value).toBe(String(config.physics.gravity));
  expect(mutation?.new_value).toBe("3.7");
  expect(mutation?.merkle_hash).toBeTruthy();
});

test("WorldConfigManager: verify fails when stored config snapshot is tampered with", () => {
  const runId = "run-config-verify";
  const config = loadTemplate();

  RunManager.createRun(runId, config.meta.name, 0);
  WorldConfigManager.create(config, runId, db);

  db.db.query("UPDATE runs SET world_config = ? WHERE id = ?").run('{"tampered":true}', runId);

  expect(WorldConfigManager.verify(runId, db)).toBe(false);
});
