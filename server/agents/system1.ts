import type {
  AgentState,
  BodyMap,
  BodyState,
  CircadianState,
  VocalActuation,
  WorldConfig,
} from "../../shared/types";

export type BodyStateDelta = Partial<BodyState>;

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class System1 {
  public static tick(
    agent: AgentState,
    circadianState: CircadianState,
    worldConfig: WorldConfig,
  ): BodyStateDelta {
    const body = agent.body;
    const delta: BodyStateDelta = {};

    // 1. Homeostasis
    delta.hunger = (body.hunger || 0) + 0.01;
    delta.thirst = (body.thirst || 0) + 0.02;

    // 2. Circadian integration
    const hormoneTarget = circadianState.cycleHormoneValue;
    delta.cycleHormone = (body.cycleHormone || 0) * 0.9 + hormoneTarget * 0.1;

    // Fatigue accumulates faster when hormone is high
    const fatigueRate = 0.01 * (1 + delta.cycleHormone * 2);
    delta.fatigue = (body.fatigue || 0) + fatigueRate;

    // 3. Body schema
    const newBodyMap = { ...body.bodyMap };
    let maxPain = 0;

    for (const key of Object.keys(newBodyMap) as (keyof BodyMap)[]) {
      const part = newBodyMap[key];
      if (part) {
        part.temperature += (15 - part.temperature) * 0.05;
        part.pain *= 0.95;
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }
    delta.bodyMap = newBodyMap;

    // 4. IntegrityDrive (ω)
    const omega = worldConfig.freeWill.survivalDriveWeight;
    const threat = 0; // placeholder
    delta.integrityDrive =
      omega * ((delta.hunger || 0) * 0.3 + (maxPain / 100) * 0.4 + threat * 0.3);

    return delta;
  }

  public static checkVocalActuation(agent: AgentState, tick: number): VocalActuation | null {
    const body = agent.body;

    let maxPain = 0;
    if (body.bodyMap) {
      for (const part of Object.values(body.bodyMap)) {
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }

    if (maxPain > 70) {
      return {
        emitterId: agent.id,
        soundToken: "AARGH",
        arousal: 0.9,
        valence: -0.8,
        tick,
      };
    }

    if (body.arousal > 0.8 && body.valence < -0.5) {
      return {
        emitterId: agent.id,
        soundToken: "EKK-EKK",
        arousal: 0.8,
        valence: -0.5,
        tick,
      };
    }

    return null;
  }

  public static computeConflictOutcome(
    agentA: AgentState,
    agentB: AgentState,
  ): { damageA: number; damageB: number } {
    const powerA =
      agentA.muscleStats.strength * 0.5 +
      agentA.muscleStats.speed * 0.3 +
      agentA.muscleStats.endurance * 0.2;
    const powerB =
      agentB.muscleStats.strength * 0.5 +
      agentB.muscleStats.speed * 0.3 +
      agentB.muscleStats.endurance * 0.2;

    const diff = powerA - powerB;
    return {
      damageA: Math.max(0, 10 - diff * 5),
      damageB: Math.max(0, 10 + diff * 5),
    };
  }
}
