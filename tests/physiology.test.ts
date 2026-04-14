import { expect, test } from "bun:test";
import {
  computeChestPressure,
  computeOralDryness,
  computeVisceralContraction,
  type PhysiologyParams,
  updatePhysiology,
} from "../server/agents/physiology";
import type { PhysiologyState } from "../shared/types";

const baseParams: PhysiologyParams = {
  energyDrainPerTick: 0.01,
  hydrationDrainPerTick: 0.02,
  oxygenRecoveryPerTick: 0.03,
  toxinDecayPerTick: 0.01,
  fatigueRecoveryPerTick: 0.01,
  starvationDamageThreshold: 0.2,
  dehydrationDamageThreshold: 0.2,
  toxinDamageThreshold: 0.3,
  hypoxiaDamageThreshold: 0.2,
  optimalCoreTemperature: 15,
  coldTolerance: 8,
  heatTolerance: 8,
};

const basePhysiology: PhysiologyState = {
  energyReserves: 0.9,
  hydration: 0.8,
  oxygenSaturation: 1,
  toxinLoad: 0.1,
  immuneBurden: 0.1,
  health: 1,
  fatigue: 0.2,
  coreTemperature: 15,
  actuationEnergyRecent: 0,
};

test("physiology: update drains reserves and stays deterministic", () => {
  const next = updatePhysiology({
    physiology: basePhysiology,
    params: baseParams,
    ambientTemperature: 15,
    submerged: false,
    actuationCost: 0.5,
  });

  expect(next.energyReserves).toBeLessThan(basePhysiology.energyReserves);
  expect(next.hydration).toBeLessThan(basePhysiology.hydration);
  expect(next.oxygenSaturation).toBeGreaterThanOrEqual(basePhysiology.oxygenSaturation - 0.0001);
});

test("physiology: dehydration damages health faster than starvation", () => {
  const dehydrated = updatePhysiology({
    physiology: {
      ...basePhysiology,
      energyReserves: 0.9,
      hydration: 0.1,
      health: 1,
    },
    params: baseParams,
    ambientTemperature: 15,
    submerged: false,
    actuationCost: 0,
  });

  const starved = updatePhysiology({
    physiology: {
      ...basePhysiology,
      energyReserves: 0.1,
      hydration: 0.9,
      health: 1,
    },
    params: baseParams,
    ambientTemperature: 15,
    submerged: false,
    actuationCost: 0,
  });

  expect(dehydrated.health).toBeLessThan(starved.health);
});

test("physiology: submersion reduces oxygen saturation", () => {
  const submerged = updatePhysiology({
    physiology: basePhysiology,
    params: baseParams,
    ambientTemperature: 15,
    submerged: true,
    actuationCost: 0,
  });

  expect(submerged.oxygenSaturation).toBeLessThan(basePhysiology.oxygenSaturation);
});

test("physiology: interoceptive derivations increase with deficit", () => {
  expect(computeVisceralContraction(0.2)).toBeGreaterThan(computeVisceralContraction(0.8));
  expect(computeOralDryness(0.2)).toBeGreaterThan(computeOralDryness(0.8));
  expect(computeChestPressure(0.2)).toBeGreaterThan(computeChestPressure(0.8));
});
