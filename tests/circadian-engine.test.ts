import { expect, test } from "bun:test";
import { CircadianEngine } from "../server/world/circadian-engine";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { CircadianConfig } from "../shared/types";

const config: CircadianConfig = {
  enabled: true,
  cycleLengthTicks: 100,
  lightCurve: "sine",
  temperatureDelta: 10.0,
  cycleHormoneEnabled: true,
  cycleHormoneLabel: "cycle_flux",
  seasonEnabled: true,
  seasonLengthCycles: 4,
};

test("CircadianEngine: lightLevel 0->1->0 over one cycle", () => {
  // sine curve
  expect(CircadianEngine.computeLightLevel(0, config)).toBeCloseTo(0.0);
  expect(CircadianEngine.computeLightLevel(25, config)).toBeCloseTo(0.5);
  expect(CircadianEngine.computeLightLevel(50, config)).toBeCloseTo(1.0);
  expect(CircadianEngine.computeLightLevel(75, config)).toBeCloseTo(0.5);
  expect(CircadianEngine.computeLightLevel(100, config)).toBeCloseTo(0.0);
});

test("CircadianEngine: cycleHormone is inverse of lightLevel", () => {
  const light1 = CircadianEngine.computeLightLevel(50, config); // 1.0
  const hormone1 = CircadianEngine.computeCycleHormone(light1, config);
  expect(hormone1).toBeCloseTo(0.0);

  const light2 = CircadianEngine.computeLightLevel(0, config); // 0.0
  const hormone2 = CircadianEngine.computeCycleHormone(light2, config);
  expect(hormone2).toBeCloseTo(1.0);
});

test("CircadianEngine: surface temperature shifts with light", () => {
  // lightLevel = 0.0 -> temperatureDelta = -5
  // lightLevel = 1.0 -> temperatureDelta = +5
  const tempDark = CircadianEngine.computeSurfaceTemperature(0.0, config);
  expect(tempDark).toBeCloseTo(-5.0);

  const tempLight = CircadianEngine.computeSurfaceTemperature(1.0, config);
  expect(tempLight).toBeCloseTo(5.0);
});

test("CircadianEngine: season advances over multiple cycles", () => {
  // 1 cycle = 100 ticks, seasonLength = 4 cycles
  expect(CircadianEngine.computeSeason(0, config)).toBe("spring"); // Cycle 0
  expect(CircadianEngine.computeSeason(100, config)).toBe("summer"); // Cycle 1
  expect(CircadianEngine.computeSeason(200, config)).toBe("autumn"); // Cycle 2
  expect(CircadianEngine.computeSeason(300, config)).toBe("winter"); // Cycle 3
  expect(CircadianEngine.computeSeason(400, config)).toBe("spring"); // Cycle 4
});

test("CircadianEngine: updates world lighting", () => {
  const grid = new VoxelGrid(1, 1, 2); // column of height 2
  grid.set(0, 1, 0, {
    type: 1,
    material: "dirt",
    temperature: 15,
    moisture: 0.5,
    fertility: 0.5,
    lightLevel: 0.0,
  });
  grid.set(0, 0, 0, {
    type: 1,
    material: "stone",
    temperature: 15,
    moisture: 0.5,
    fertility: 0.0,
    lightLevel: 0.0,
  });

  CircadianEngine.updateWorldLighting(grid, 0.8);

  // Top voxel (y=1) should be 0.8
  expect(grid.getLightLevel(0, 1, 0)).toBeCloseTo(0.8);
  // Bottom voxel (y=0) should still be 0.0
  expect(grid.getLightLevel(0, 0, 0)).toBeCloseTo(0.0);
});
