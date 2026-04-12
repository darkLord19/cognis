import type { RunState } from "../../shared/types";
import { db } from "../persistence/database";

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
    return db.db.query("SELECT * FROM runs WHERE id = ?").get(id) as RunRecord | null;
  },

  listRuns(): RunRecord[] {
    return db.db.query("SELECT * FROM runs ORDER BY start_tick DESC").all() as RunRecord[];
  },

  updateRunStatus(id: string, status: RunState): void {
    db.db.query("UPDATE runs SET status = ? WHERE id = ?").run(status, id);
  },

  updateCurrentTick(id: string, tick: number): void {
    db.db.query("UPDATE runs SET current_tick = ? WHERE id = ?").run(tick, id);
  },

  getCurrentTick(id: string): number {
    const row = db.db
      .query<{ current_tick: number }, [string]>("SELECT current_tick FROM runs WHERE id = ?")
      .get(id);
    return row?.current_tick ?? 0;
  },

  stopRun(id: string, endTick: number): void {
    db.db
      .query("UPDATE runs SET status = ?, end_tick = ?, current_tick = ? WHERE id = ?")
      .run("stopped", endTick, endTick, id);
  },
};
