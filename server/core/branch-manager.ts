import { db } from "../persistence/database";

export const BranchManager = {
  createBranch(id: string, name: string, tick: number, parentId: string | null = null): void {
    const existing = BranchManager.getBranch(id);
    if (existing) {
      return;
    }

    db.db
      .query("INSERT INTO branches (id, parent_id, tick, name) VALUES (?, ?, ?, ?)")
      .run(id, parentId, tick, name);
  },

  getBranch(id: string): Record<string, unknown> | null {
    return db.db.query("SELECT * FROM branches WHERE id = ?").get(id) as Record<
      string,
      unknown
    > | null;
  },

  getWorldStateAtTick(branchId: string, tick: number): Uint8Array | null {
    const row = db.db
      .query<{ voxel_data: Uint8Array }, [string, number]>(
        "SELECT voxel_data FROM world_deltas WHERE branch_id = ? AND tick <= ? ORDER BY tick DESC LIMIT 1",
      )
      .get(branchId, tick);
    return row ? row.voxel_data : null;
  },
};
