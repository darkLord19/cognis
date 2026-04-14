import type { PhysiologyParams } from "../agents/physiology";

export type MetabolismProfile = PhysiologyParams;

export const DEFAULT_METABOLISM_PROFILE: MetabolismProfile = {
  energyDrainPerTick: 0.0015,
  hydrationDrainPerTick: 0.002,
  oxygenRecoveryPerTick: 0.03,
  toxinDecayPerTick: 0.005,
  fatigueRecoveryPerTick: 0.03,
  starvationDamageThreshold: 0.15,
  dehydrationDamageThreshold: 0.2,
  toxinDamageThreshold: 0.3,
  hypoxiaDamageThreshold: 0.35,
  optimalCoreTemperature: 37,
  coldTolerance: 8,
  heatTolerance: 10,
};
