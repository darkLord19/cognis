CREATE TABLE agent_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  state_data TEXT NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE episodic_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  qualia_text TEXT NOT NULL,
  salience REAL NOT NULL,
  emotional_valence REAL NOT NULL,
  emotional_arousal REAL NOT NULL,
  suppressed BOOLEAN NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  context_tags TEXT,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE semantic_beliefs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_count INTEGER NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE feeling_residues (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  valence REAL NOT NULL,
  arousal REAL NOT NULL,
  source_event_id TEXT,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE lexicon_entries (
  agent_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  word TEXT NOT NULL,
  concept TEXT NOT NULL,
  confidence REAL NOT NULL,
  consensus_count INTEGER NOT NULL,
  PRIMARY KEY (agent_id, branch_id, word),
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);
