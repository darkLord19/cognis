import {
  BASE_FATIGUE_RATE,
  HUNGER_RATE,
  STARVATION_DAMAGE_RATE,
  STARVATION_HUNGER_THRESHOLD,
  THIRST_RATE,
} from "../../shared/constants";
import type { BodyState, PhysiologyState } from "../../shared/types";

/**
 * Updates the internal physiology state of an agent.
 * This logic represents the "latent" body math.
 * The Qualia layer will later translate these into sensations.
 */
export function calculateNextPhysiology(current: BodyState, tickDelta = 1): PhysiologyState {
  // Energy (inverse of hunger)
  const energyDelta = HUNGER_RATE * tickDelta;
  const nextEnergy = Math.max(0, current.energy - energyDelta);

  // Hydration (inverse of thirst)
  const hydrationDelta = THIRST_RATE * tickDelta;
  const nextHydration = Math.max(0, current.hydration - hydrationDelta);

  // Fatigue
  const fatigueDelta = BASE_FATIGUE_RATE * tickDelta;
  const nextFatigue = Math.min(1, current.fatigue + fatigueDelta);

  // Health
  let healthDelta = 0;

  // Damage from starvation (low energy)
  if (nextEnergy < 1 - STARVATION_HUNGER_THRESHOLD) {
    healthDelta += STARVATION_DAMAGE_RATE * tickDelta;
  }

  // Damage from dehydration (low hydration)
  if (nextHydration < 1 - STARVATION_HUNGER_THRESHOLD) {
    healthDelta += STARVATION_DAMAGE_RATE * tickDelta;
  }

  const nextHealth = Math.max(0, current.health - healthDelta);

  // Toxin load decay (detoxification)
  const nextToxinLoad = Math.max(0, current.toxinLoad - 0.01 * tickDelta);

  // Inflammation decay
  const nextInflammation = Math.max(0, current.inflammation - 0.005 * tickDelta);

  return {
    energy: nextEnergy,
    hydration: nextHydration,
    toxinLoad: nextToxinLoad,
    oxygenation: current.oxygenation, // Placeholder, usually handled by environment
    fatigue: nextFatigue,
    coreTemperature: current.coreTemperature,
    inflammation: nextInflammation,
    painLoad: current.painLoad,
    health: nextHealth,
  };
}
