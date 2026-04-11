import { beforeAll, expect, test } from "bun:test";
import { db } from "../server/persistence/database";
import { DeltaStream } from "../server/world/delta-stream";
import { TerrainGenerator } from "../server/world/terrain-generator";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { TerrainConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM world_deltas");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('test_branch', 0, 'test')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

test("VoxelGrid: set and get", () => {
  const grid = new VoxelGrid(10, 10, 10);

  grid.set(5, 5, 5, {
    type: 1,
    material: "stone",
    temperature: 20,
    moisture: 0.5,
    fertility: 0.1,
    lightLevel: 0.8,
  });

  const v = grid.get(5, 5, 5);
  expect(v).toBeTruthy();
  expect(v!.material).toBe("stone");
  expect(v!.temperature).toBe(20);
  expect(grid.getLightLevel(5, 5, 5)).toBeCloseTo(0.8);
});

test("DeltaStream: flush and reconstruct", () => {
  const grid = new VoxelGrid(5, 5, 5);
  grid.set(1, 1, 1, {
    type: 1,
    material: "dirt",
    temperature: 10,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });
  grid.set(2, 2, 2, {
    type: 2,
    material: "wood",
    temperature: 10,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });

  const dirties = grid.getDirtyVoxels();
  expect(dirties.length).toBe(2);

  DeltaStream.flushTick("test_branch", 1, dirties);
  grid.clearDirty();
  expect(grid.getDirtyVoxels().length).toBe(0);

  // Now reconstruct
  const reconstructed = DeltaStream.reconstruct("test_branch", 1, 5, 5, 5);
  const v1 = reconstructed.get(1, 1, 1);
  const v2 = reconstructed.get(2, 2, 2);

  expect(v1!.material).toBe("dirt");
  expect(v2!.material).toBe("wood");
});

test("TerrainGenerator: builds valid grid", () => {
  const config: TerrainConfig = {
    width: 10,
    depth: 10,
    height: 10,
    seed: 123,
    waterLevel: 0.2,
    biomes: ["plains"],
  };

  const grid = TerrainGenerator.generate(config);

  // Just check if it's populated (not all air/null)
  let nonAirCount = 0;
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      for (let z = 0; z < 10; z++) {
        const v = grid.get(x, y, z);
        if (v && v.material !== "air") nonAirCount++;
      }
    }
  }

  expect(nonAirCount).toBeGreaterThan(0);
});
