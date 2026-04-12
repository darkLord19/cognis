import type { Voxel } from "../../shared/types";
import { db } from "../persistence/database";
import { VoxelGrid } from "./voxel-grid";

export const DeltaStream = {
  flushTick(
    branchId: string,
    tick: number,
    dirtyVoxels: (Voxel & { x: number; y: number; z: number })[],
    causeEventId: string | null = null,
  ): void {
    if (dirtyVoxels.length === 0) return;

    const deltaPayload = JSON.stringify(dirtyVoxels);
    const encoder = new TextEncoder();
    const voxelData = encoder.encode(deltaPayload);

    db.db
      .query(
        "INSERT OR REPLACE INTO world_deltas (branch_id, tick, voxel_data, cause_event_id) VALUES (?, ?, ?, ?)",
      )
      .run(branchId, tick, voxelData, causeEventId);
  },

  reconstruct(
    branchId: string,
    targetTick: number,
    width: number,
    depth: number,
    height: number,
  ): VoxelGrid {
    const grid = new VoxelGrid(width, depth, height);

    // We fetch all deltas up to targetTick in ascending order to apply them
    // PRD says reconstruct from base snapshot + deltas, but we only have deltas for now.
    const rows = db.db
      .query<{ voxel_data: Uint8Array }, [string, number]>(
        "SELECT voxel_data FROM world_deltas WHERE branch_id = ? AND tick <= ? ORDER BY tick ASC",
      )
      .all(branchId, targetTick) as { voxel_data: Uint8Array }[];

    const decoder = new TextDecoder();

    for (const row of rows) {
      const payload = decoder.decode(row.voxel_data);
      const changes = JSON.parse(payload) as (Voxel & { x: number; y: number; z: number })[];
      for (const change of changes) {
        grid.set(change.x, change.y, change.z, change);
      }
    }

    grid.clearDirty(); // Clean up state after reconstruction
    return grid;
  },
};
