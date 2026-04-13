import { createNoise2D } from "simplex-noise";
import type { MaterialType, TerrainConfig } from "../../shared/types";
import { VoxelGrid } from "./voxel-grid";

// Quick seeded random for JS
function mulberry32(a: number) {
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TerrainGenerator = {
  generate(config: TerrainConfig): VoxelGrid {
    const grid = new VoxelGrid(config.width, config.depth, config.height);
    const rand = mulberry32(config.seed);

    // simple seeded noise function adapter
    const noise2D = createNoise2D(() => rand());

    for (let x = 0; x < config.width; x++) {
      for (let z = 0; z < config.depth; z++) {
        // -1 to 1
        const n = noise2D(x / 50, z / 50);
        // Normalize to 0 to 1
        const normalized = (n + 1) / 2;
        // Scale to height, reserving top and bottom bounds roughly
        const heightMapY = Math.floor(normalized * (config.height * 0.8));

        for (let y = 0; y < config.height; y++) {
          if (y <= heightMapY) {
            let mat: MaterialType = "stone";
            if (y === heightMapY) mat = "dirt"; // Top layer is dirt

            grid.set(x, y, z, {
              type: 1,
              material: mat,
              temperature: 15,
              moisture: y <= config.waterLevel * config.height ? 1.0 : 0.2,
              fertility: mat === "dirt" ? 0.8 : 0.0,
              lightLevel: y === heightMapY ? 1.0 : 0.0, // Surface lit
            });
          } else if (y <= config.waterLevel * config.height) {
            grid.set(x, y, z, {
              type: 2,
              material: "water",
              temperature: 10,
              moisture: 1.0,
              fertility: 0.0,
              lightLevel: 0.5,
            });
          } else {
            grid.set(x, y, z, {
              type: 0,
              material: "air",
              temperature: 15,
              moisture: 0.0,
              fertility: 0.0,
              lightLevel: 1.0,
            });
          }
        }
      }
    }

    grid.clearDirty();
    return grid;
  },
};
