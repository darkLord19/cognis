CREATE TABLE IF NOT EXISTS procedural_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tick INTEGER NOT NULL,

  cue_signature TEXT NOT NULL,
  target_signature TEXT,
  motor_plan_json TEXT NOT NULL,

  delta_visceral_contraction REAL NOT NULL,
  delta_oral_dryness REAL NOT NULL,
  delta_pain REAL NOT NULL,
  delta_toxin_load REAL NOT NULL,
  delta_health REAL NOT NULL,
  relief_score REAL NOT NULL,
  harm_score REAL NOT NULL,

  success INTEGER NOT NULL,
  merkle_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_procedural_outcomes_agent_tick
ON procedural_outcomes(agent_id, tick);

CREATE INDEX IF NOT EXISTS idx_procedural_outcomes_cue
ON procedural_outcomes(agent_id, cue_signature);
