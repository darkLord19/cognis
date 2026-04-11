CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_tick INTEGER NOT NULL,
  end_tick INTEGER,
  status TEXT NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  tick INTEGER NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY(parent_id) REFERENCES branches(id)
);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  type TEXT NOT NULL,
  agent_id TEXT,
  target_id TEXT,
  payload TEXT NOT NULL,
  importance INTEGER,
  baseline_config TEXT,
  FOREIGN KEY(branch_id) REFERENCES branches(id),
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE world_deltas (
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  voxel_data BLOB NOT NULL,
  cause_event_id TEXT,
  PRIMARY KEY (branch_id, tick),
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);