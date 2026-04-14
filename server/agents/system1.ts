import {
  ALARM_AROUSAL_THRESHOLD,
  ALARM_VALENCE_THRESHOLD,
  AMBIENT_TEMPERATURE,
  BIOMASS_INTEGRITY_FLUX,
  BODY_TEMP_CONVERGENCE_RATE,
  COLLAPSE_HEALTH_THRESHOLD,
  CONFLICT_MIN_DEFENSE,
  CYCLE_HORMONE_INERTIA,
  CYCLE_HORMONE_REACTIVITY,
  FLEE_THRESHOLD,
  PAIN_DECAY_RATE,
  PAIN_VOCAL_THRESHOLD,
  PLEASURE_AROUSAL_THRESHOLD,
  PLEASURE_VALENCE_THRESHOLD,
  RECOIL_PAIN_THRESHOLD,
} from "../../shared/constants";
import type {
  AgentState,
  BodyMap,
  BodyStateDelta,
  CircadianState,
  ConflictDelta,
  EmotionalFieldData,
  MaterialType,
  VocalActuation,
  WorldConfig,
} from "../../shared/types";
import { calculateNextPhysiology } from "./physiology";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getHealthScale(health: number | undefined): number {
  return (health ?? 1) > 1 ? 100 : 1;
}

function averageBodyTemperatureDeviation(body: BodyMap): number {
  const parts = Object.values(body);
  if (parts.length === 0) return 0;

  const deviation = parts.reduce(
    (sum, part) => sum + Math.abs(part.temperature - AMBIENT_TEMPERATURE),
    0,
  );
  return deviation / parts.length;
}

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
    context?: {
      localMaterial?: MaterialType | undefined;
      biomassAvailable?: number;
    },
  ): BodyStateDelta {
    const body = agent.body;

    // 1. Latent Physiology Update
    const nextPhys = calculateNextPhysiology(body);
    const delta: BodyStateDelta = {
      energy: nextPhys.energy,
      hydration: nextPhys.hydration,
      fatigue: nextPhys.fatigue,
      health: nextPhys.health,
      toxinLoad: nextPhys.toxinLoad,
      inflammation: nextPhys.inflammation,
    };

    if (delta.health === 0 && (body.health ?? 1) > 0) {
      delta.shouldDie = true;
    }

    // 2. Circadian integration
    const hormoneTarget = circadianState.lightLevel < 0.3 ? 1.0 : 0.0; // Simple inverse for now
    delta.cycleHormone =
      (body.cycleHormone || 0) * CYCLE_HORMONE_INERTIA + hormoneTarget * CYCLE_HORMONE_REACTIVITY;

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
    const healthDeficit = clamp01(1 - (delta.health ?? body.health ?? 1));
    const temperatureStress = clamp01(
      Math.max(
        Math.abs((body.coreTemperature ?? AMBIENT_TEMPERATURE) - AMBIENT_TEMPERATURE),
        averageBodyTemperatureDeviation(newBodyMap),
      ) / 20,
    );
    const fatigueStress = clamp01(delta.fatigue ?? body.fatigue ?? 0);
    const hydrationStress = clamp01(1 - (delta.hydration ?? body.hydration ?? 1));
    const energyStress = clamp01(1 - (delta.energy ?? body.energy ?? 1));

    const threat = clamp01(
      (healthDeficit + temperatureStress + fatigueStress + hydrationStress) / 4,
    );
    let integrityDrive = omega * clamp01(energyStress + maxPain + threat);

    const canConsumeBiomass =
      context?.localMaterial === "biomass" &&
      (agent.currentAction?.type === "INGEST_ATTEMPT" ||
        agent.currentAction?.type === "MOUTH_CONTACT");

    if (canConsumeBiomass) {
      const available = Math.max(0, context?.biomassAvailable ?? 0);
      const consumed = Math.min(BIOMASS_INTEGRITY_FLUX, available);
      if (consumed > 0) {
        delta.biomassConsumed = consumed;
        integrityDrive = Math.max(0, integrityDrive - consumed);
        delta.energy = clamp01((delta.energy ?? body.energy) + consumed);
      }
    }

    delta.integrityDrive = integrityDrive;

    return delta;
  },

  /**
   * Check for immediate reflexive reactions that bypass System2.
   * PRD: RECOIL (high pain), FLEE (extreme danger), COLLAPSE (near-death).
   */
  checkImmediateReaction(agent: AgentState): ImmediateReaction | null {
    const body = agent.body;
    const healthScale = getHealthScale(body.health);
    const normalizedHealth = clamp01((body.health ?? healthScale) / healthScale);

    // Find max pain across body parts
    let maxPain = 0;
    if (body.bodyMap) {
      for (const part of Object.values(body.bodyMap)) {
        if (part.pain > maxPain) maxPain = part.pain;
      }
    }

    // COLLAPSE — agent near death
    if (body.health !== undefined && normalizedHealth < COLLAPSE_HEALTH_THRESHOLD) {
      return {
        type: "COLLAPSE",
        agentId: agent.id,
        intensity: 1.0 - normalizedHealth,
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

    // Reflexive pain cry
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

  computeConflictOutcome(agentA: AgentState, agentB: AgentState, actuatorForce = 1): ConflictDelta {
    const defenseA = Math.max(
      CONFLICT_MIN_DEFENSE,
      agentA.muscleStats.speed + agentA.muscleStats.endurance,
    );
    const defenseB = Math.max(
      CONFLICT_MIN_DEFENSE,
      agentB.muscleStats.speed + agentB.muscleStats.endurance,
    );
    return {
      damageA: (agentB.muscleStats.strength * actuatorForce) / defenseA,
      damageB: (agentA.muscleStats.strength * actuatorForce) / defenseB,
    };
  },
};
