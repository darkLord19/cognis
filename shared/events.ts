import type { BaselineConfig } from "./types";

export enum EventType {
  TICK = "tick",
  VOXEL_CHANGED = "voxel_changed",
  ELEMENT_SPREAD = "element_spread",
  RESOURCE_DEPLETED = "resource_depleted",
  STRUCTURE_BUILT = "structure_built",
  VOXEL_MARKED = "voxel_marked",
  CIRCADIAN_PHASE_CHANGED = "circadian_phase_changed",
  SEASON_CHANGED = "season_changed",

  AGENT_BORN = "agent_born",
  AGENT_DIED = "agent_died",
  AGENT_SLEPT = "agent_slept",
  AGENT_WOKE = "agent_woke",
  VOCAL_ACTUATION = "vocal_actuation",

  SYSTEM2_THOUGHT = "system2_thought",
  DECISION_MADE = "decision_made",
  INNER_CONFLICT = "inner_conflict",
  URGENCY_OVERRIDE = "urgency_override",

  MEMORY_ENCODED = "memory_encoded",
  MEMORY_CONSOLIDATED = "memory_consolidated",
  MEMORY_SUPPRESSED = "memory_suppressed",
  TRAUMA_FORMED = "trauma_formed",
  TRAUMA_RESOLVED = "trauma_resolved",
  DREAM_OCCURRED = "dream_occurred",
  NIGHTMARE_OCCURRED = "nightmare_occurred",

  PROTO_WORD_COINED = "proto_word_coined",
  WORD_ENTERED_LEXICON = "word_entered_lexicon",
  GRAMMAR_RULE_FORMED = "grammar_rule_formed",
  DIALECT_DIVERGED = "dialect_diverged",

  CONVERSATION_STARTED = "conversation_started",
  KNOWLEDGE_TRANSFERRED = "knowledge_transferred",
  RELATIONSHIP_CHANGED = "relationship_changed",
  BEHAVIOURAL_PATTERN_OBSERVED = "behavioural_pattern_observed",
  FACTION_FORMED = "faction_formed",

  DOMESTICATION_STAGE_CHANGED = "domestication_stage_changed",
  TECH_DISCOVERED = "tech_discovered",
  DEATH_CONCEPT_DISCOVERED = "death_concept_discovered",

  TIPPING_POINT_DETECTED = "tipping_point_detected",
  CAUSAL_PATTERN_FOUND = "causal_pattern_found",
  EMERGENCE_DETECTED = "emergence_detected",
  BRANCH_CREATED = "branch_created",
  BASELINE_DIVERGENCE_FOUND = "baseline_divergence_found",

  INTERVENTION_APPLIED = "intervention_applied",
  INTERVENTION_RESISTED = "intervention_resisted",
  GLASS_ROOM_ENTERED = "glass_room_entered",
  GLASS_ROOM_EXITED = "glass_room_exited",
  MERKLE_CHAIN_VERIFIED = "merkle_chain_verified",
}

export interface SimEvent {
  event_id: string;
  branch_id: string;
  run_id: string;
  tick: number;
  type: EventType;
  agent_id?: string;
  target_id?: string;
  payload: Record<string, unknown>;
  importance?: number;
  baseline_config?: BaselineConfig;
}
