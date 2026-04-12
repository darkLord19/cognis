import { expect, test } from "bun:test";
import { ElementEngine } from "../server/world/element-engine";
import { PhysicsEngine } from "../server/world/physics-engine";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { PhysicsPreset } from "../shared/types";

const mockPreset: PhysicsPreset = {
  name: "custom",
  gravity: 9.8,
  atmospherePressure: 1.0,
  oxygenLevel: 0.21,
  temperatureBaseline: 15,
  materialDensities: {
    stone: 2,
    dirt: 1.5,
    wood: 0.5,
    water: 1,
    ore: 3,
    food: 0.5,
    air: 0,
    fire: 0,
  },
  flammability: { stone: 0, dirt: 0, wood: 1, water: 0, ore: 0, food: 0, air: 0, fire: 0 },
  thermalConductivity: { stone: 0, dirt: 0, wood: 0, water: 0, ore: 0, food: 0, air: 0, fire: 0 },
};

test("ElementEngine: fire extinguishes without fuel", () => {
  const physics = new PhysicsEngine(mockPreset);
  const elements = new ElementEngine(physics);
  const grid = new VoxelGrid(3, 3, 3);

  grid.set(1, 1, 1, {
    type: 8,
    material: "fire",
    temperature: 200,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });
  grid.set(1, 1, 2, {
    type: 1,
    material: "stone",
    temperature: 15,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  }); // not flammable

  // Run enough ticks to ensure it extinguishes
  for (let i = 0; i < 50; i++) {
    elements.tick(grid);
  }

  const v = grid.get(1, 1, 1);
  expect(v?.material).toBe("air");
});

test("ElementEngine: fire spreads to fuel", () => {
  const highlyFlammablePreset = {
    ...mockPreset,
    flammability: { ...mockPreset.flammability, wood: 100 },
  };
  const elements = new ElementEngine(new PhysicsEngine(highlyFlammablePreset));
  const grid = new VoxelGrid(3, 3, 3);

  grid.set(1, 1, 1, {
    type: 8,
    material: "fire",
    temperature: 200,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });
  grid.set(1, 1, 2, {
    type: 3,
    material: "wood",
    temperature: 15,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  }); // flammable

  // Tick once, guaranteed to spread due to high flammability
  elements.tick(grid);

  const v = grid.get(1, 1, 2);
  expect(v?.material).toBe("fire");
});
