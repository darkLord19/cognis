import { db } from "../persistence/database";

export const RunManager = {
  createRun(id: string, name: string, startTick: number): void {
    const existing = RunManager.getRun(id);
    if (existing) {
      return;
    }

    db.db
      .query("INSERT INTO runs (id, name, start_tick, status) VALUES (?, ?, ?, ?)")
      .run(id, name, startTick, "running");
  },

  getRun(id: string): Record<string, unknown> | null {
    return db.db.query("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown> | null;
  },

  stopRun(id: string, endTick: number): void {
    db.db
      .query("UPDATE runs SET status = ?, end_tick = ? WHERE id = ?")
      .run("stopped", endTick, id);
  },
};
