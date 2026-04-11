import { db } from "../persistence/database";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class BranchManager {
  public static createBranch(
    id: string,
    name: string,
    tick: number,
    parentId: string | null = null,
  ): void {
    db.db
      .query("INSERT INTO branches (id, parent_id, tick, name) VALUES (?, ?, ?, ?)")
      .run(id, parentId, tick, name);
  }

  public static getBranch(id: string): Record<string, unknown> | null {
    return db.db.query("SELECT * FROM branches WHERE id = ?").get(id) as Record<
      string,
      unknown
    > | null;
  }

  public static getWorldStateAtTick(branchId: string, tick: number): Uint8Array | null {
    const row = db.db
      .query<{ voxel_data: Uint8Array }, [string, number]>(
        "SELECT voxel_data FROM world_deltas WHERE branch_id = ? AND tick <= ? ORDER BY tick DESC LIMIT 1",
      )
      .get(branchId, tick);
    return row ? row.voxel_data : null;
  }
}
