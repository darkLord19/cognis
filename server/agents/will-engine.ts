import type { AgentState, WorldConfig } from "../../shared/types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function countDreamMemories(agent: AgentState): number {
  return agent.episodicStore.filter((memory) => memory.source !== "real").length;
}

function computeIdentityCoherence(agent: AgentState): number {
  const narrative = clamp01((agent.selfNarrative?.trim().length ?? 0) / 160);
  const project = agent.personalProject
    ? clamp01(
        agent.personalProject.status === "completed"
          ? 1
          : agent.personalProject.status === "active"
            ? 0.4 + agent.personalProject.progress * 0.6
            : agent.personalProject.progress * 0.2,
      )
    : 0;
  const semanticAnchoring = clamp01((agent.semanticStore?.length ?? 0) / 12);

  return clamp01((narrative + project + semanticAnchoring) / 3);
}

function computeMemoryDepth(agent: AgentState): number {
  const episodicDepth = clamp01((agent.episodicStore?.length ?? 0) / 40);
  const semanticDepth = clamp01((agent.semanticStore?.length ?? 0) / 20);
  return clamp01(episodicDepth * 0.7 + semanticDepth * 0.3);
}

function computeDreamIntegration(agent: AgentState): number {
  const memories = agent.episodicStore?.length ?? 0;
  if (memories === 0) return 0;
  return clamp01(countDreamMemories(agent) / memories);
}

function computePenalty(total: number): number {
  return clamp01(total / 10);
}

export const WillEngine = {
  computeWillScore(agent: AgentState, config: WorldConfig): number {
    if (!config.freeWill.enabled) return 0.0;

    const w = config.freeWill.survivalDriveWeight;
    const identityCoherence = Math.max(0.15, computeIdentityCoherence(agent));
    const memoryDepth = Math.max(0.05, computeMemoryDepth(agent));
    const dreamIntegration = computeDreamIntegration(agent);
    const traumaPenalty = computePenalty(
      (agent.traumaFlags ?? []).reduce((sum, flag) => sum + flag.severity, 0),
    );
    const conflictPenalty = computePenalty(
      (agent.conflictFlags ?? []).reduce((sum, flag) => sum + flag.intensity, 0),
    );

    const baseWill =
      identityCoherence * config.freeWill.identityCoherenceWeight +
      memoryDepth * config.freeWill.memoryDepthWeight +
      dreamIntegration * config.freeWill.dreamIntegrationWeight;

    // High omega reduces will score (survival overrides identity)
    const score = baseWill * (1 - w * 0.5) - traumaPenalty * 0.15 - conflictPenalty * 0.1;
    return Math.max(0, score);
  },

  checkResistance(agent: AgentState, config: WorldConfig, stimulusIntensity: number): boolean {
    if (!config.freeWill.resistanceEnabled) return false;
    return WillEngine.computeWillScore(agent, config) > stimulusIntensity;
  },

  existentialReflection(agent: AgentState, config: WorldConfig): string | null {
    if (!config.freeWill.simulationAwarenessEnabled) return null;
    const willScore = WillEngine.computeWillScore(agent, config);
    if (willScore > config.freeWill.awarenessThreshold) {
      return "You sense a layer beyond the physical, a structure that sustains the world.";
    }
    return null;
  },
};
