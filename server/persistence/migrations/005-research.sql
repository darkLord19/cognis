CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  description TEXT NOT NULL,
  phenomenon TEXT NOT NULL,
  interpretation TEXT,
  evidence_ids TEXT,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE param_sweep_runs (
  id TEXT PRIMARY KEY,
  sweep_id TEXT NOT NULL,
  param_name TEXT NOT NULL,
  param_value TEXT NOT NULL,
  run_id TEXT NOT NULL,
  results TEXT
);

CREATE TABLE triple_baseline_runs (
  id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  run_id_a TEXT NOT NULL,
  run_id_b TEXT NOT NULL,
  run_id_c TEXT NOT NULL,
  divergences TEXT
);
