-- Append-only event tables for episodic memory modifications
-- These replace UPDATE statements to maintain append-only DB invariant

CREATE TABLE IF NOT EXISTS episodic_suppression_events (
  id TEXT PRIMARY KEY,
  target_memory_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS episodic_context_tag_events (
  id TEXT PRIMARY KEY,
  target_memory_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);
