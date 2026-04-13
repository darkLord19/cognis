CREATE TABLE IF NOT EXISTS run_config_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  world_config TEXT NOT NULL,
  world_config_hash TEXT NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

INSERT INTO run_config_snapshots (run_id, tick, world_config, world_config_hash)
SELECT id, 0, world_config, world_config_hash
FROM runs
WHERE COALESCE(world_config, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM run_config_snapshots rcs
    WHERE rcs.run_id = runs.id
  );
