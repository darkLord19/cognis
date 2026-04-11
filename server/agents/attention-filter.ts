import type {
  AgentState,
  FilteredPercept,
  PerceptionConfig,
  RawPercept,
  Voxel,
} from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class AttentionFilter {
  public static filter(
    percept: RawPercept,
    agent: AgentState,
    config: PerceptionConfig,
  ): FilteredPercept {
    const capacity = config.attentionCapacity || 5;

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
      let score = 0.1;
      if (voxel.material === "fire") score += 0.8;
      if (voxel.material === "water") score += 0.3;
      if (voxel.metadata?.markings?.length) score += 0.5;
      return { voxel, score };
    });

    scoredVoxels.sort((a, b) => b.score - a.score);
    const focusedVoxels = scoredVoxels.slice(0, 5).map((s) => s.voxel);

    // Simplistic aggregate emotional field for peripheral
    const peripheralAwareness = {
      count: peripheralCount,
      aggregateEmotionalField: peripheralCount > 0 ? 0.5 : 0.0, // mock aggregate
    };

    return {
      primaryAttention,
      peripheralAwareness,
      focusedVoxels,
      ownBody: agent.body,
    };
  }

  public static scoreEntity(
    entity: AgentState,
    agent: AgentState,
    config: PerceptionConfig,
  ): number {
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

    // Movement velocity
    const anyEntity = entity as unknown as { velocity?: { x: number; y: number; z: number } };
    let movementVelocity = 0.0;
    if (anyEntity.velocity) {
      const vMag = Math.sqrt(
        anyEntity.velocity.x ** 2 + anyEntity.velocity.y ** 2 + anyEntity.velocity.z ** 2,
      );
      movementVelocity = Math.min(1.0, vMag / 10.0);
    }

    // Novelty
    const interactions = rel ? rel.significantEvents.length : 0;
    const novelty = Math.max(0.0, 1.0 - interactions / 1000.0);

    return (
      relationshipStrength * w1 +
      emotionalFieldIntensity * w2 +
      movementVelocity * w3 +
      novelty * w4
    );
  }
}
