import type { RunState, RunSummary } from "../../shared/types";
import { db } from "../persistence/database";

export interface RunStateEventRecord {
  id: number;
  run_id: string;
  status: RunState;
  tick: number;
  recorded_at: string;
  metadata: string | null;
}

function parseMetadata(metadata: string | null): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export type RunStateSnapshot = RunStateEventRecord & {
  parsedMetadata: Record<string, unknown> | undefined;
};

export const RunStateStore = {
  record(
    runId: string,
    status: RunState,
    tick: number,
    metadata?: Record<string, unknown>,
  ): void {
    db.db
      .query("INSERT INTO run_state_events (run_id, status, tick, metadata) VALUES (?, ?, ?, ?)")
      .run(runId, status, tick, metadata ? JSON.stringify(metadata) : null);
  },

  getLatest(runId: string): RunStateSnapshot | null {
    const row = db.db
      .query<RunStateEventRecord, [string]>(
        `SELECT id, run_id, status, tick, recorded_at, metadata
         FROM run_state_events
         WHERE run_id = ?
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(runId);

    if (!row) {
      return null;
    }

    return { ...row, parsedMetadata: parseMetadata(row.metadata) };
  },

  listSummaries(): RunSummary[] {
    const runs = db.db
      .query<{ id: string; name: string; start_tick: number; end_tick: number | null }, []>(
        "SELECT id, name, start_tick, end_tick FROM runs ORDER BY start_tick DESC",
      )
      .all();

    return runs.map((run) => {
      const latest = RunStateStore.getLatest(run.id);
      return {
        id: run.id,
        name: run.name,
        startTick: run.start_tick,
        ...(run.end_tick === null ? {} : { endTick: run.end_tick }),
        status: latest?.status ?? "created",
        currentTick: latest?.tick ?? run.start_tick,
      };
    });
  },
};
