CREATE TABLE runs_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_tick INTEGER NOT NULL,
  end_tick INTEGER,
  status TEXT NOT NULL,
  world_config TEXT NOT NULL DEFAULT '{}',
  world_config_hash TEXT NOT NULL DEFAULT ''
);

INSERT INTO runs_new (id, name, start_tick, end_tick, status, world_config, world_config_hash)
SELECT id, name, start_tick, end_tick, status, '{}', ''
FROM runs;

DROP TABLE runs;
ALTER TABLE runs_new RENAME TO runs;

CREATE TABLE IF NOT EXISTS config_mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  path TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  cause_event_id TEXT,
  merkle_hash TEXT NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);
