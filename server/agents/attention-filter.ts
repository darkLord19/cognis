import {
  DEFAULT_ATTENTION_CAPACITY,
  FIRE_INTEREST_SCORE,
  MARKING_INTEREST_SCORE,
  MAX_FOCUSED_VOXELS,
  NOVELTY_DECAY_INTERACTIONS,
  VELOCITY_NORMALIZATION,
  VOXEL_BASE_INTEREST,
  WATER_INTEREST_SCORE,
} from "../../shared/constants";
import type { AgentState, FilteredPercept, PerceptionConfig, RawPercept } from "../../shared/types";

export const AttentionFilter = {
  filter(percept: RawPercept, agent: AgentState, config: PerceptionConfig): FilteredPercept {
    const capacity = config.attentionCapacity || DEFAULT_ATTENTION_CAPACITY;

    // Score and sort visible agents
    const scoredAgents = percept.visibleAgents.map((otherAgent) => {
      const score = AttentionFilter.scoreEntity(otherAgent, agent, config);
      return { agent: otherAgent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);

    const primaryAttention = scoredAgents.slice(0, capacity).map((s) => s.agent);
    const peripheralCount = Math.max(0, scoredAgents.length - capacity);

    // Score and sort voxels
    const scoredVoxels = percept.nearbyVoxels.map((voxel) => {
      let score = VOXEL_BASE_INTEREST;
      if (voxel.material === "fire") score += FIRE_INTEREST_SCORE;
      if (voxel.material === "water") score += WATER_INTEREST_SCORE;
      if (voxel.metadata?.markings?.length) score += MARKING_INTEREST_SCORE;
      return { voxel, score };
    });

    scoredVoxels.sort((a, b) => b.score - a.score);
    const focusedVoxels = scoredVoxels.slice(0, MAX_FOCUSED_VOXELS).map((s) => s.voxel);

    const peripheralAwareness = {
      count: peripheralCount,
      aggregateEmotionalField: peripheralCount > 0 ? 0.5 : 0.0,
    };

    return { primaryAttention, peripheralAwareness, focusedVoxels, ownBody: agent.body };
  },

  scoreEntity(entity: AgentState, agent: AgentState, config: PerceptionConfig): number {
    const w1 = config.attentionWeights.relationshipStrength;
    const w2 = config.attentionWeights.emotionalFieldIntensity;
    const w3 = config.attentionWeights.movementVelocity;
    const w4 = config.attentionWeights.novelty;

    // Relationship strength
    const rel = agent.relationships.find((r) => r.targetAgentId === entity.id);
    const relationshipStrength = rel
      ? Math.max(Math.abs(rel.affinity), Math.abs(rel.fear), Math.abs(rel.trust))
      : 0.0;

    // Emotional field intensity (magnitude of valence + arousal)
    const emotionalFieldIntensity = Math.min(
      1.0,
      (Math.abs(entity.body.valence) + Math.abs(entity.body.arousal)) / 2.0,
    );

    // Movement velocity — computed from position if velocity is not available
    // Note: velocity tracking requires storing previous positions; for now we use 0
    const movementVelocity = 0.0;

    // Novelty
    const interactions = rel ? rel.significantEvents.length : 0;
    const novelty = Math.max(0.0, 1.0 - interactions / NOVELTY_DECAY_INTERACTIONS);

    return (
      relationshipStrength * w1 +
      emotionalFieldIntensity * w2 +
      movementVelocity * w3 +
      novelty * w4
    );
  },
};

// Re-export for any code relying on VELOCITY_NORMALIZATION from this module
export { VELOCITY_NORMALIZATION };
