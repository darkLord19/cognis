import type { MaterialType } from "../../shared/types";

export type MaterialDefinition = {
  id: string;

  density: number;
  hardness: number;
  thermalMass: number;
  flammabilityCoefficient: number;
  waterSolubility: number;

  nutritionalValue: number;
  hydrationValue: number;
  toxicity: number;
  toxicityOnsetTicks: number;
  analgesicValue: number;
  digestibilityBySpecies: Record<string, number>;

  touchTexture: "smooth" | "rough" | "wet" | "sharp" | "soft" | "crumbly";
  tasteProfile?: {
    channel0: number;
    channel1: number;
    channel2: number;
    channel3: number;
    channel4: number;
  };
  olfactorySignature?: number;
};

export const V1_MATERIALS: Record<string, MaterialDefinition> = {
  fresh_water: {
    id: "fresh_water",
    density: 1,
    hardness: 0,
    thermalMass: 0.8,
    flammabilityCoefficient: 0,
    waterSolubility: 1,
    nutritionalValue: 0,
    hydrationValue: 0.7,
    toxicity: 0,
    toxicityOnsetTicks: 0,
    analgesicValue: 0,
    digestibilityBySpecies: { proto_human: 1 },
    touchTexture: "wet",
    tasteProfile: { channel0: 0, channel1: 0.1, channel2: 0, channel3: 0, channel4: 0 },
    olfactorySignature: 0.1,
  },

  edible_soft_plant: {
    id: "edible_soft_plant",
    nutritionalValue: 0.35,
    hydrationValue: 0.15,
    toxicity: 0,
    toxicityOnsetTicks: 0,
    analgesicValue: 0,
    digestibilityBySpecies: { proto_human: 0.8 },
    density: 0.2,
    hardness: 0.1,
    thermalMass: 0.3,
    flammabilityCoefficient: 0.4,
    waterSolubility: 0.2,
    touchTexture: "soft",
    tasteProfile: { channel0: 0.5, channel1: 0.1, channel2: 0.1, channel3: 0.05, channel4: 0.25 },
    olfactorySignature: 0.4,
  },

  toxic_bitter_plant: {
    id: "toxic_bitter_plant",
    nutritionalValue: 0.05,
    hydrationValue: 0.05,
    toxicity: 0.75,
    toxicityOnsetTicks: 25,
    analgesicValue: 0,
    digestibilityBySpecies: { proto_human: 0.2 },
    density: 0.2,
    hardness: 0.1,
    thermalMass: 0.3,
    flammabilityCoefficient: 0.4,
    waterSolubility: 0.2,
    touchTexture: "soft",
    tasteProfile: { channel0: 0.1, channel1: 0.1, channel2: 0.3, channel3: 0.95, channel4: 0 },
    olfactorySignature: 0.3,
  },
};

export type MaterialAffordance = {
  energyGain: number;
  hydrationGain: number;
  toxinLoad: number;
  painDelta: number;
  arousalDelta: number;
};

const LEGACY_MATERIAL_TO_V1: Partial<Record<MaterialType, keyof typeof V1_MATERIALS>> = {
  water: "fresh_water",
  food: "edible_soft_plant",
  biomass: "edible_soft_plant",
};

function materialOrThrow(id: keyof typeof V1_MATERIALS): MaterialDefinition {
  const material = V1_MATERIALS[id];
  if (!material) {
    throw new Error(`Missing material definition: ${id}`);
  }
  return material;
}

const freshWater = materialOrThrow("fresh_water");
const edibleSoftPlant = materialOrThrow("edible_soft_plant");
const toxicBitterPlant = materialOrThrow("toxic_bitter_plant");

export const MATERIAL_AFFORDANCES: Partial<Record<MaterialType, MaterialAffordance>> = {
  water: {
    energyGain: 0,
    hydrationGain: freshWater.hydrationValue,
    toxinLoad: 0,
    painDelta: 0,
    arousalDelta: -0.1,
  },
  food: {
    energyGain: edibleSoftPlant.nutritionalValue,
    hydrationGain: edibleSoftPlant.hydrationValue,
    toxinLoad: 0,
    painDelta: 0,
    arousalDelta: 0.1,
  },
  biomass: {
    energyGain: toxicBitterPlant.nutritionalValue,
    hydrationGain: toxicBitterPlant.hydrationValue,
    toxinLoad: toxicBitterPlant.toxicity,
    painDelta: 0,
    arousalDelta: 0.2,
  },
};

export function getMaterialDefinitionByMaterialType(
  material: MaterialType,
): MaterialDefinition | null {
  const mapped = LEGACY_MATERIAL_TO_V1[material];
  return mapped ? (V1_MATERIALS[mapped] ?? null) : null;
}

export function getMaterialAffordance(material: MaterialType): MaterialAffordance {
  const direct = MATERIAL_AFFORDANCES[material];
  if (direct) return direct;

  const definition = getMaterialDefinitionByMaterialType(material);
  if (!definition) {
    return {
      energyGain: 0,
      hydrationGain: 0,
      toxinLoad: 0,
      painDelta: 0,
      arousalDelta: 0,
    };
  }

  return {
    energyGain: definition.nutritionalValue,
    hydrationGain: definition.hydrationValue,
    toxinLoad: definition.toxicity,
    painDelta: 0,
    arousalDelta: 0,
  };
}
