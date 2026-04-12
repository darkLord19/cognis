import type { AgentState, WorldConfig } from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class WillEngine {
  public static computeWillScore(agent: AgentState, config: WorldConfig): number {
    if (!config.freeWill.enabled) return 0.0;

    const w = config.freeWill.survivalDriveWeight;
    const identityCoherence = 0.5; // placeholder
    const memoryDepth = Math.min(1.0, (agent.episodicStore?.length || 0) / 100);
    const dreamIntegration = 0.5; // placeholder

    const baseWill =
      identityCoherence * config.freeWill.identityCoherenceWeight +
      memoryDepth * config.freeWill.memoryDepthWeight +
      dreamIntegration * config.freeWill.dreamIntegrationWeight;

    // High omega reduces will score (survival overrides identity)
    return baseWill * (1 - w * 0.5);
  }

  public static checkResistance(
    agent: AgentState,
    config: WorldConfig,
    stimulusIntensity: number,
  ): boolean {
    if (!config.freeWill.resistanceEnabled) return false;
    const willScore = WillEngine.computeWillScore(agent, config);
    return willScore > stimulusIntensity;
  }

  public static existentialReflection(agent: AgentState, config: WorldConfig): string | null {
    if (!config.freeWill.simulationAwarenessEnabled) return null;
    const willScore = WillEngine.computeWillScore(agent, config);
    if (willScore > config.freeWill.awarenessThreshold) {
      return "You sense a layer beyond the physical, a structure that sustains the world.";
    }
    return null;
  }
}
