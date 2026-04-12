import { expect, test } from "bun:test";
import { Pathfinding } from "../server/world/pathfinding";
import { VoxelGrid } from "../server/world/voxel-grid";

function makeAir(grid: VoxelGrid, x: number, y: number, z: number): void {
  grid.set(x, y, z, {
    type: 0,
    material: "air",
    temperature: 0,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });
}

test("Pathfinding returns a straight route through open space", () => {
  const grid = new VoxelGrid(4, 4, 4);
  const pathfinding = new Pathfinding();

  for (let x = 0; x < 4; x += 1) {
    for (let y = 0; y < 4; y += 1) {
      for (let z = 0; z < 4; z += 1) {
        makeAir(grid, x, y, z);
      }
    }
  }

  const path = pathfinding.findPath(grid, { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 });

  expect(path).toEqual([
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ]);
});

test("Pathfinding routes around a blocked direct corridor", () => {
  const grid = new VoxelGrid(4, 4, 4);
  const pathfinding = new Pathfinding();

  for (let x = 0; x < 4; x += 1) {
    for (let y = 0; y < 4; y += 1) {
      for (let z = 0; z < 4; z += 1) {
        makeAir(grid, x, y, z);
      }
    }
  }

  grid.set(1, 0, 0, {
    type: 1,
    material: "stone",
    temperature: 0,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });

  const path = pathfinding.findPath(grid, { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 });

  expect(path.length).toBeGreaterThan(3);
  expect(path[0]).toEqual({ x: 0, y: 1, z: 0 });
  expect(path.at(-1)).toEqual({ x: 3, y: 0, z: 0 });
  expect(path.some((step) => step.x === 1 && step.y === 0 && step.z === 0)).toBe(false);
});

test("Pathfinding returns no route when the target is blocked", () => {
  const grid = new VoxelGrid(4, 4, 4);
  const pathfinding = new Pathfinding();

  for (let x = 0; x < 4; x += 1) {
    for (let y = 0; y < 4; y += 1) {
      for (let z = 0; z < 4; z += 1) {
        makeAir(grid, x, y, z);
      }
    }
  }

  grid.set(3, 0, 0, {
    type: 1,
    material: "stone",
    temperature: 0,
    moisture: 0,
    fertility: 0,
    lightLevel: 0,
  });

  expect(pathfinding.findPath(grid, { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })).toEqual([]);
});
