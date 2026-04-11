CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL,
  branch_id TEXT NOT NULL,
  agent_id TEXT,
  system TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  cause_event_id TEXT,
  cause_description TEXT,
  suppressed BOOLEAN DEFAULT FALSE,
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);
