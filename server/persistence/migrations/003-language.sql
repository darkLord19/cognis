CREATE TABLE utterances (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  speaker_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  content TEXT NOT NULL,
  listeners TEXT,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE grammar_rules (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence REAL NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE dialect_distances (
  source_faction_id TEXT NOT NULL,
  target_faction_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  distance REAL NOT NULL,
  PRIMARY KEY (source_faction_id, target_faction_id, branch_id),
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE vocal_actuations (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  emitter_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  sound_token TEXT NOT NULL,
  arousal REAL NOT NULL,
  valence REAL NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(id)
);
