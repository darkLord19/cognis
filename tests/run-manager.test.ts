import { beforeAll, expect, test } from "bun:test";
import { BranchManager } from "../server/core/branch-manager";
import { RunManager } from "../server/core/run-manager";
import { db } from "../server/persistence/database";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM world_deltas");
  db.db.exec("DELETE FROM runs");
  db.db.exec("DELETE FROM branches");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

test("RunManager: CRUD", () => {
  RunManager.createRun("run1", "Test Run", 0);
  const run = RunManager.getRun("run1");
  expect(run).toBeTruthy();
  expect(run?.name).toBe("Test Run");
  expect(run?.status).toBe("running");

  RunManager.stopRun("run1", 100);
  const stopped = RunManager.getRun("run1");
  expect(stopped?.status).toBe("stopped");
  expect(stopped?.end_tick).toBe(100);
});

test("BranchManager: CRUD and state reconstruction", () => {
  BranchManager.createBranch("main_branch", "Main Branch", 0);
  const branch = BranchManager.getBranch("main_branch");
  expect(branch).toBeTruthy();
  expect(branch?.name).toBe("Main Branch");

  BranchManager.createBranch("fork1", "Fork 1", 50, "main_branch");
  const fork = BranchManager.getBranch("fork1");
  expect(fork?.parent_id).toBe("main_branch");

  db.db
    .query("INSERT INTO world_deltas (branch_id, tick, voxel_data) VALUES (?, ?, ?)")
    .run("main_branch", 10, new Uint8Array([1, 2, 3]));
  db.db
    .query("INSERT INTO world_deltas (branch_id, tick, voxel_data) VALUES (?, ?, ?)")
    .run("main_branch", 20, new Uint8Array([4, 5, 6]));

  const state15 = BranchManager.getWorldStateAtTick("main_branch", 15);
  expect(state15).toEqual(new Uint8Array([1, 2, 3]));

  const state25 = BranchManager.getWorldStateAtTick("main_branch", 25);
  expect(state25).toEqual(new Uint8Array([4, 5, 6]));
});
