import type { SimEvent } from "../../shared/events";
import { db } from "../persistence/database";

type StoredEventRow = {
  event_id: string;
  branch_id: string;
  run_id: string;
  tick: number;
  type: SimEvent["type"];
  agent_id: string | null;
  target_id: string | null;
  payload: string;
  importance: number | null;
  baseline_config: string | null;
};

function parsePayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseBaselineConfig(value: string | null): SimEvent["baseline_config"] {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string" ? (parsed as SimEvent["baseline_config"]) : undefined;
  } catch {
    return undefined;
  }
}

export function loadBranchEvents(branchId: string): SimEvent[] {
  const rows = db.db
    .query<StoredEventRow, [string]>(
      "SELECT event_id, branch_id, run_id, tick, type, agent_id, target_id, payload, importance, baseline_config FROM events WHERE branch_id = ? ORDER BY tick ASC, rowid ASC",
    )
    .all(branchId) as StoredEventRow[];

  return rows.map((row) => {
    const event: SimEvent = {
      event_id: row.event_id,
      branch_id: row.branch_id,
      run_id: row.run_id,
      tick: row.tick,
      type: row.type,
      payload: parsePayload(row.payload),
    };

    if (row.agent_id !== null) {
      event.agent_id = row.agent_id;
    }
    if (row.target_id !== null) {
      event.target_id = row.target_id;
    }
    if (row.importance !== null) {
      event.importance = row.importance;
    }

    const baselineConfig = parseBaselineConfig(row.baseline_config);
    if (baselineConfig !== undefined) {
      event.baseline_config = baselineConfig;
    }

    return event;
  });
}

export function getBranchEventCounts(branchId: string): Array<{ tick: number; count: number }> {
  const counts = new Map<number, number>();
  for (const event of loadBranchEvents(branchId)) {
    counts.set(event.tick, (counts.get(event.tick) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([tick, count]) => ({ tick, count }))
    .sort((left, right) => left.tick - right.tick);
}
