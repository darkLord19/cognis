import type { MaterialType } from "../../shared/types";

/**
 * MaterialAffordance defines the objective physical impact of interacting
 * with a material. This is "Operator-layer" truth.
 */
export type MaterialAffordance = {
  energyGain: number;
  hydrationGain: number;
  toxinLoad: number;
  painDelta: number;
  arousalDelta: number;
};

export const MATERIAL_AFFORDANCES: Partial<Record<MaterialType, MaterialAffordance>> = {
  water: {
    energyGain: 0,
    hydrationGain: 0.4,
    toxinLoad: 0,
    painDelta: 0,
    arousalDelta: -0.1,
  },
  food: {
    energyGain: 0.3,
    hydrationGain: 0.1,
    toxinLoad: 0,
    painDelta: 0,
    arousalDelta: 0.1,
  },
  biomass: {
    energyGain: 0.2,
    hydrationGain: 0,
    toxinLoad: 0.1,
    painDelta: 0,
    arousalDelta: 0.2,
  },
  stone: {
    energyGain: 0,
    hydrationGain: 0,
    toxinLoad: 0,
    painDelta: 0.05,
    arousalDelta: 0.1,
  },
  dirt: {
    energyGain: 0.01,
    hydrationGain: 0,
    toxinLoad: 0.05,
    painDelta: 0,
    arousalDelta: 0,
  },
  fire: {
    energyGain: 0,
    hydrationGain: -0.1,
    toxinLoad: 0,
    painDelta: 0.8,
    arousalDelta: 0.9,
  },
};

export function getMaterialAffordance(material: MaterialType): MaterialAffordance {
  return (
    MATERIAL_AFFORDANCES[material] || {
      energyGain: 0,
      hydrationGain: 0,
      toxinLoad: 0,
      painDelta: 0,
      arousalDelta: 0,
    }
  );
}
