import {
  AMBIENT_TEMPERATURE,
  BASE_FATIGUE_RATE,
  HUNGER_RATE,
  STARVATION_HUNGER_THRESHOLD,
  THIRST_RATE,
} from "../../shared/constants";
import type { BodyState, PhysiologyState } from "../../shared/types";

export type PhysiologyParams = {
  energyDrainPerTick: number;
  hydrationDrainPerTick: number;
  oxygenRecoveryPerTick: number;
  toxinDecayPerTick: number;
  fatigueRecoveryPerTick: number;

  starvationDamageThreshold: number;
  dehydrationDamageThreshold: number;
  toxinDamageThreshold: number;
  hypoxiaDamageThreshold: number;

  optimalCoreTemperature: number;
  coldTolerance: number;
  heatTolerance: number;
};

export function getDefaultPhysiologyParams(tickDelta = 1): PhysiologyParams {
  const threshold = Math.max(0, 1 - STARVATION_HUNGER_THRESHOLD);
  return {
    energyDrainPerTick: HUNGER_RATE * tickDelta,
    hydrationDrainPerTick: THIRST_RATE * tickDelta,
    oxygenRecoveryPerTick: 0.03 * tickDelta,
    toxinDecayPerTick: 0.01 * tickDelta,
    fatigueRecoveryPerTick: BASE_FATIGUE_RATE * tickDelta,
    starvationDamageThreshold: threshold,
    dehydrationDamageThreshold: threshold,
    toxinDamageThreshold: 0.5,
    hypoxiaDamageThreshold: 0.2,
    optimalCoreTemperature: AMBIENT_TEMPERATURE,
    coldTolerance: 8,
    heatTolerance: 8,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fromBodyState(body: BodyState): PhysiologyState {
  const physiology = body.physiology;
  if (physiology) {
    return {
      ...physiology,
      energy: physiology.energy ?? body.energy,
      oxygenation: physiology.oxygenation ?? body.oxygenation,
      inflammation: physiology.inflammation ?? body.inflammation,
      painLoad: physiology.painLoad ?? body.painLoad,
    };
  }

  return {
    energyReserves: body.energy,
    hydration: body.hydration,
    oxygenSaturation: body.oxygenation,
    toxinLoad: body.toxinLoad,
    immuneBurden: body.inflammation,
    health: body.health,
    fatigue: body.fatigue,
    coreTemperature: body.coreTemperature,
    actuationEnergyRecent: 0,
    energy: body.energy,
    oxygenation: body.oxygenation,
    inflammation: body.inflammation,
    painLoad: body.painLoad,
  };
}

function computeThermalDamage(input: {
  coreTemperature: number;
  params: PhysiologyParams;
}): number {
  const { coreTemperature, params } = input;
  const coldBound = params.optimalCoreTemperature - params.coldTolerance;
  const heatBound = params.optimalCoreTemperature + params.heatTolerance;

  if (coreTemperature < coldBound) {
    return (coldBound - coreTemperature) * 0.0005;
  }
  if (coreTemperature > heatBound) {
    return (coreTemperature - heatBound) * 0.0005;
  }
  return 0;
}

export function updatePhysiology(input: {
  physiology: PhysiologyState;
  params: PhysiologyParams;
  ambientTemperature: number;
  submerged: boolean;
  actuationCost: number;
}): PhysiologyState {
  const { physiology, params, ambientTemperature, submerged, actuationCost } = input;

  const energyReserves = clamp01(
    physiology.energyReserves - (params.energyDrainPerTick + actuationCost * 0.4),
  );
  const hydration = clamp01(
    physiology.hydration - (params.hydrationDrainPerTick + actuationCost * 0.2),
  );
  const fatigue = clamp01(physiology.fatigue + actuationCost - params.fatigueRecoveryPerTick);

  const oxygenSaturation = submerged
    ? clamp01(physiology.oxygenSaturation - 0.04)
    : clamp01(Math.min(1, physiology.oxygenSaturation + params.oxygenRecoveryPerTick));

  const toxinLoad = Math.max(0, physiology.toxinLoad - params.toxinDecayPerTick);
  const immuneBurden = clamp01(
    Math.max(0, physiology.immuneBurden + toxinLoad * 0.05 - params.toxinDecayPerTick * 0.5),
  );

  const thermalConvergence = 0.05;
  const coreTemperature =
    physiology.coreTemperature +
    (ambientTemperature - physiology.coreTemperature) * thermalConvergence;

  let health = physiology.health;
  if (energyReserves < params.starvationDamageThreshold) health -= 0.001;
  if (hydration < params.dehydrationDamageThreshold) health -= 0.003;
  if (oxygenSaturation < params.hypoxiaDamageThreshold) health -= 0.02;
  if (toxinLoad > params.toxinDamageThreshold) health -= toxinLoad * 0.002;
  health -= computeThermalDamage({ coreTemperature, params });
  health = clamp01(health);

  const actuationEnergyRecent = clamp01(
    physiology.actuationEnergyRecent * 0.8 + actuationCost * 0.2,
  );

  return {
    energyReserves,
    hydration,
    oxygenSaturation,
    toxinLoad,
    immuneBurden,
    health,
    fatigue,
    coreTemperature,
    actuationEnergyRecent,
    energy: energyReserves,
    oxygenation: oxygenSaturation,
    inflammation: immuneBurden,
    painLoad: physiology.painLoad ?? 0,
  };
}

/**
 * Legacy compatibility wrapper used by existing System1 integration.
 */
export function calculateNextPhysiology(current: BodyState, tickDelta = 1): PhysiologyState {
  const physiology = fromBodyState(current);
  const params = getDefaultPhysiologyParams(tickDelta);

  return updatePhysiology({
    physiology,
    params,
    ambientTemperature: AMBIENT_TEMPERATURE,
    submerged: false,
    actuationCost: 0,
  });
}

export function computeVisceralContraction(energyReserves: number): number {
  return (1 - clamp01(energyReserves)) ** 1.5;
}

export function computeOralDryness(hydration: number): number {
  return (1 - clamp01(hydration)) ** 2.0;
}

export function computeChestPressure(oxygenSaturation: number): number {
  return (1 - clamp01(oxygenSaturation)) ** 3.0;
}
