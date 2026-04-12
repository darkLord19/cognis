import {
  ALARM_AROUSAL_THRESHOLD,
  ALARM_VALENCE_THRESHOLD,
  AMBIENT_TEMPERATURE,
  BASE_FATIGUE_RATE,
  BODY_TEMP_CONVERGENCE_RATE,
  COLLAPSE_HEALTH_THRESHOLD,
  CONFLICT_BASE_DAMAGE,
  CONFLICT_DAMAGE_MULTIPLIER,
  CONFLICT_ENDURANCE_WEIGHT,
  CONFLICT_SPEED_WEIGHT,
  CONFLICT_STRENGTH_WEIGHT,
  CYCLE_HORMONE_INERTIA,
  CYCLE_HORMONE_REACTIVITY,
  FATIGUE_HORMONE_MULTIPLIER,
  FLEE_THRESHOLD,
  HUNGER_RATE,
  INTEGRITY_HUNGER_WEIGHT,
  INTEGRITY_PAIN_WEIGHT,
  INTEGRITY_THREAT_WEIGHT,
  PAIN_DECAY_RATE,
  PAIN_VOCAL_THRESHOLD,
  PLEASURE_AROUSAL_THRESHOLD,
  PLEASURE_VALENCE_THRESHOLD,
  RECOIL_PAIN_THRESHOLD,
  THIRST_RATE,
} from "../../shared/constants";
import type {
  AgentState,
  BodyMap,
  BodyStateDelta,
  CircadianState,
  ConflictDelta,
  EmotionalFieldData,
  VocalActuation,
  WorldConfig,
} from "../../shared/types";

export type ImmediateReaction = {
  type: "RECOIL" | "FLEE" | "COLLAPSE";
  agentId: string;
  intensity: number;
};

export const System1 = {
  tick(
    agent: AgentState,
    circadianState: CircadianState,
    worldConfig: WorldConfig,
  ): BodyStateDelta {
    const body = agent.body;
    const delta: BodyStateDelta = {};

    // 1. Homeostasis
    delta.hunger = (body.hunger || 0) + HUNGER_RATE;
    delta.thirst = (body.thirst || 0) + THIRST_RATE;

    // 2. Circadian integration
    const hormoneTarget = circadianState.cycleHormoneValue;
    delta.cycleHormone =
      (body.cycleHormone || 0) * CYCLE_HORMONE_INERTIA + hormoneTarget * CYCLE_HORMONE_REACTIVITY;

    // Fatigue accumulates faster when hormone is high
    const fatigueRate =
      BASE_FATIGUE_RATE * (1 + (delta.cycleHormone ?? 0) * FATIGUE_HORMONE_MULTIPLIER);
    delta.fatigue = (body.fatigue || 0) + fatigueRate;

    // 3. Body schema
    const newBodyMap = { ...body.bodyMap };
    let maxPain = 0;

    for (const key of Object.keys(newBodyMap) as (keyof BodyMap)[]) {
      const part = newBodyMap[key];
      if (part) {
        part.temperature += (AMBIENT_TEMPERATURE - part.temperature) * BODY_TEMP_CONVERGENCE_RATE;
        part.pain *= PAIN_DECAY_RATE;
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }
    delta.bodyMap = newBodyMap;

    // 4. IntegrityDrive (ω)
    const omega = worldConfig.freeWill.survivalDriveWeight;
    const threat = 0; // placeholder — calculated from environmental danger later
    delta.integrityDrive =
      omega *
      ((delta.hunger || 0) * INTEGRITY_HUNGER_WEIGHT +
        maxPain * INTEGRITY_PAIN_WEIGHT +
        threat * INTEGRITY_THREAT_WEIGHT);

    return delta;
  },

  /**
   * Check for immediate reflexive reactions that bypass System2.
   * PRD: RECOIL (high pain), FLEE (extreme danger), COLLAPSE (near-death).
   */
  checkImmediateReaction(agent: AgentState): ImmediateReaction | null {
    const body = agent.body;

    // Find max pain across body parts
    let maxPain = 0;
    if (body.bodyMap) {
      for (const part of Object.values(body.bodyMap)) {
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }

    // COLLAPSE — agent near death
    if (body.health !== undefined && body.health < COLLAPSE_HEALTH_THRESHOLD) {
      return {
        type: "COLLAPSE",
        agentId: agent.id,
        intensity: 1.0 - (body.health ?? 0),
      };
    }

    // FLEE — extreme combined threat
    const fleeScore = maxPain * 0.5 + (body.integrityDrive || 0) * 0.5;
    if (fleeScore > FLEE_THRESHOLD) {
      return { type: "FLEE", agentId: agent.id, intensity: fleeScore };
    }

    // RECOIL — sudden sharp pain
    if (maxPain > RECOIL_PAIN_THRESHOLD) {
      return { type: "RECOIL", agentId: agent.id, intensity: maxPain };
    }

    return null;
  },

  /**
   * Compute emotional field emission for this agent.
   * Other agents sense this via EmotionalField.detectFields().
   */
  emitEmotionalField(agent: AgentState): EmotionalFieldData {
    return {
      agentId: agent.id,
      valence: agent.body.valence,
      arousal: agent.body.arousal,
    };
  },

  checkVocalActuation(agent: AgentState, tick: number): VocalActuation | null {
    const body = agent.body;

    let maxPain = 0;
    if (body.bodyMap) {
      for (const part of Object.values(body.bodyMap)) {
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }

    // Pain cry
    if (maxPain > PAIN_VOCAL_THRESHOLD) {
      return { emitterId: agent.id, soundToken: "AARGH", arousal: 0.9, valence: -0.8, tick };
    }

    // Alarm call
    if (body.arousal > ALARM_AROUSAL_THRESHOLD && body.valence < ALARM_VALENCE_THRESHOLD) {
      return { emitterId: agent.id, soundToken: "EKK-EKK", arousal: 0.8, valence: -0.5, tick };
    }

    // Pleasure vocalisation
    if (body.valence > PLEASURE_VALENCE_THRESHOLD && body.arousal > PLEASURE_AROUSAL_THRESHOLD) {
      return {
        emitterId: agent.id,
        soundToken: "MMM",
        arousal: body.arousal,
        valence: body.valence,
        tick,
      };
    }

    return null;
  },

  computeConflictOutcome(agentA: AgentState, agentB: AgentState): ConflictDelta {
    const powerA =
      agentA.muscleStats.strength * CONFLICT_STRENGTH_WEIGHT +
      agentA.muscleStats.speed * CONFLICT_SPEED_WEIGHT +
      agentA.muscleStats.endurance * CONFLICT_ENDURANCE_WEIGHT;
    const powerB =
      agentB.muscleStats.strength * CONFLICT_STRENGTH_WEIGHT +
      agentB.muscleStats.speed * CONFLICT_SPEED_WEIGHT +
      agentB.muscleStats.endurance * CONFLICT_ENDURANCE_WEIGHT;

    const diff = powerA - powerB;
    return {
      damageA: Math.max(0, CONFLICT_BASE_DAMAGE - diff * CONFLICT_DAMAGE_MULTIPLIER),
      damageB: Math.max(0, CONFLICT_BASE_DAMAGE + diff * CONFLICT_DAMAGE_MULTIPLIER),
    };
  },
};
