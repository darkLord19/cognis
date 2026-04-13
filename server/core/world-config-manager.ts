import type { WorldConfig } from "../../shared/types";
import type { Database } from "../persistence/database";

type MerkleLoggerLike = {
  log: (
    tick: number,
    branchId: string,
    agentId: string | null,
    system: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    causeEventId: string | null,
  ) => void;
};

type ConfigMutationRow = {
  id: number;
  branch_id: string;
  tick: number;
  path: string;
  old_value: string;
  new_value: string;
  applied_by: string;
  cause_event_id: string | null;
  merkle_hash: string;
};

type RunConfigSnapshotRow = {
  id: number;
  run_id: string;
  tick: number;
  world_config: string;
  world_config_hash: string;
};

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, normalizeValue(entryValue)]),
    );
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value ?? null));
}

function hashString(value: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex");
}

function getValueAtPath(target: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, target);
}

function setValueAtPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  const last = segments.pop();
  if (!last) {
    return;
  }

  let current: Record<string, unknown> = target;
  for (const segment of segments) {
    const next = current[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[last] = value;
}

export const WorldConfigManager = {
  hashWorldConfig(config: WorldConfig): string {
    return hashString(stableStringify(config));
  },

  create(template: WorldConfig, runId: string, database: Database): void {
    const canonical = stableStringify(template);
    const hash = hashString(canonical);

    const run = database.db
      .query<{ id: string }, [string]>("SELECT id FROM runs WHERE id = ?")
      .get(runId);

    if (!run) {
      throw new Error(`Run ${runId} must exist before persisting world config.`);
    }

    const existing = database.db
      .query<RunConfigSnapshotRow, [string]>(
        `SELECT id, run_id, tick, world_config, world_config_hash
         FROM run_config_snapshots
         WHERE run_id = ?
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(runId);

    if (existing) {
      return;
    }

    database.db
      .query(
        "INSERT INTO run_config_snapshots (run_id, tick, world_config, world_config_hash) VALUES (?, ?, ?, ?)",
      )
      .run(runId, 0, canonical, hash);
  },

  load(runId: string, branchId: string, tick: number, database: Database): WorldConfig {
    const snapshot = database.db
      .query<RunConfigSnapshotRow, [string, number]>(
        `SELECT id, run_id, tick, world_config, world_config_hash
         FROM run_config_snapshots
         WHERE run_id = ? AND tick <= ?
         ORDER BY tick DESC, id DESC
         LIMIT 1`,
      )
      .get(runId, tick);

    if (!snapshot?.world_config) {
      throw new Error(`Run ${runId} does not have a persisted world config snapshot.`);
    }

    const config = JSON.parse(snapshot.world_config) as WorldConfig;
    const mutations = database.db
      .query<ConfigMutationRow, [string, number]>(
        "SELECT * FROM config_mutations WHERE branch_id = ? AND tick <= ? ORDER BY tick ASC, id ASC",
      )
      .all(branchId, tick);

    for (const mutation of mutations) {
      setValueAtPath(
        config as unknown as Record<string, unknown>,
        mutation.path,
        JSON.parse(mutation.new_value),
      );
    }

    return config;
  },

  mutate(
    runId: string,
    branchId: string,
    tick: number,
    path: string,
    newValue: unknown,
    database: Database,
    merkleLogger: MerkleLoggerLike,
    appliedBy: "operator" | "system" = "operator",
    causeEventId: string | null = null,
  ): void {
    const current = WorldConfigManager.load(runId, branchId, tick, database);
    const oldValue = getValueAtPath(current as unknown as Record<string, unknown>, path);
    const serializedOld = stableStringify(oldValue);
    const serializedNew = stableStringify(newValue);

    merkleLogger.log(
      tick,
      branchId,
      null,
      "WorldConfig",
      path,
      serializedOld,
      serializedNew,
      causeEventId,
    );

    const merkleHash = database.getLastAuditHash(branchId);

    database.db
      .query(`
        INSERT INTO config_mutations (
          branch_id, tick, path, old_value, new_value, applied_by, cause_event_id, merkle_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(branchId, tick, path, serializedOld, serializedNew, appliedBy, causeEventId, merkleHash);
  },

  verify(runId: string, database: Database): boolean {
    const snapshot = database.db
      .query<RunConfigSnapshotRow, [string]>(
        `SELECT id, run_id, tick, world_config, world_config_hash
         FROM run_config_snapshots
         WHERE run_id = ?
         ORDER BY tick DESC, id DESC
         LIMIT 1`,
      )
      .get(runId);

    if (!snapshot?.world_config || !snapshot.world_config_hash) {
      return false;
    }

    const canonical = stableStringify(JSON.parse(snapshot.world_config));
    return hashString(canonical) === snapshot.world_config_hash;
  },
};
