import { db } from "../persistence/database";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class RunManager {
  public static createRun(id: string, name: string, startTick: number): void {
    db.db
      .query("INSERT INTO runs (id, name, start_tick, status) VALUES (?, ?, ?, ?)")
      .run(id, name, startTick, "running");
  }

  public static getRun(id: string): Record<string, unknown> | null {
    return db.db.query("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown> | null;
  }

  public static stopRun(id: string, endTick: number): void {
    db.db
      .query("UPDATE runs SET status = ?, end_tick = ? WHERE id = ?")
      .run("stopped", endTick, id);
  }
}
