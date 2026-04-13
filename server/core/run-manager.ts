import type { RunState } from "../../shared/types";
import { db } from "../persistence/database";
import { RunStateStore } from "./run-state-store";

export interface RunRecord {
  id: string;
  name: string;
  start_tick: number;
  end_tick: number | null;
  status: RunState;
  world_config: string;
  world_config_hash: string;
  current_tick: number;
}

export const RunManager = {
  createRun(id: string, name: string, startTick: number, config?: object): void {
    const existing = RunManager.getRun(id);
    if (existing) {
      return;
    }

    const worldConfig = config ? JSON.stringify(config) : "{}";

    db.db
      .query(
        "INSERT INTO runs (id, name, start_tick, status, world_config, world_config_hash, current_tick) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, name, startTick, "created", worldConfig, "", startTick);
  },

  getRun(id: string): RunRecord | null {
    const run = db.db.query("SELECT * FROM runs WHERE id = ?").get(id) as RunRecord | null;
    if (!run) {
      return null;
    }

    const latest = RunStateStore.getLatest(id);
    const status = latest?.status ?? run.status;
    const currentTick = latest?.tick ?? run.current_tick;
    const endTick =
      status === "stopped" || status === "completed"
        ? (latest?.tick ?? run.end_tick)
        : run.end_tick;

    return {
      ...run,
      status,
      current_tick: currentTick,
      end_tick: endTick,
    };
  },

  listRuns(): RunRecord[] {
    const runs = db.db.query("SELECT * FROM runs ORDER BY start_tick DESC").all() as RunRecord[];
    return runs
      .map((row) => RunManager.getRun((row as RunRecord).id))
      .filter((row): row is RunRecord => Boolean(row));
  },

  updateRunStatus(id: string, status: RunState): void {
    const currentTick = RunManager.getCurrentTick(id);
    RunStateStore.record(id, status, currentTick);
  },

  updateCurrentTick(id: string, tick: number): void {
    const currentStatus = RunStateStore.getLatest(id)?.status ?? "running";
    RunStateStore.record(id, currentStatus, tick);
  },

  getCurrentTick(id: string): number {
    const latest = RunStateStore.getLatest(id);
    if (latest) {
      return latest.tick;
    }
    const run = db.db
      .query<{ start_tick: number }, [string]>("SELECT start_tick FROM runs WHERE id = ?")
      .get(id);
    return run?.start_tick ?? 0;
  },

  stopRun(id: string, endTick: number): void {
    RunStateStore.record(id, "stopped", endTick);
  },
};
