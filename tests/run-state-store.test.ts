import { beforeEach, expect, test } from "bun:test";
import { RunStateStore } from "../server/core/run-state-store";
import { db } from "../server/persistence/database";

beforeEach(() => {
  db.db.exec("DELETE FROM run_state_events");
  db.db.exec("DELETE FROM run_config_snapshots");
  db.db.exec("DELETE FROM runs");
});

test("RunStateStore derives latest lifecycle state from append-only events", () => {
  db.db
    .query(
      "INSERT INTO runs (id, name, start_tick, status, world_config, world_config_hash, current_tick) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("run-1", "Run 1", 0, "created", "{}", "", 0);

  RunStateStore.record("run-1", "created", 0);
  RunStateStore.record("run-1", "starting", 0);
  RunStateStore.record("run-1", "running", 12);
  RunStateStore.record("run-1", "paused", 19);

  const latest = RunStateStore.getLatest("run-1");
  expect(latest?.status).toBe("paused");
  expect(latest?.tick).toBe(19);
});

test("RunStateStore lists run summaries using latest append-only state", () => {
  db.db
    .query(
      "INSERT INTO runs (id, name, start_tick, status, world_config, world_config_hash, current_tick) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("run-1", "Run 1", 0, "created", "{}", "", 0);
  db.db
    .query(
      "INSERT INTO runs (id, name, start_tick, status, world_config, world_config_hash, current_tick) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run("run-2", "Run 2", 5, "created", "{}", "", 5);

  RunStateStore.record("run-1", "running", 44);
  RunStateStore.record("run-2", "stopped", 9);

  const summaries = RunStateStore.listSummaries();
  const run1 = summaries.find((summary) => summary.id === "run-1");
  const run2 = summaries.find((summary) => summary.id === "run-2");

  expect(run1?.status).toBe("running");
  expect(run1?.currentTick).toBe(44);
  expect(run2?.status).toBe("stopped");
  expect(run2?.currentTick).toBe(9);
});
