import { BIOMASS_DECAY_TICKS } from "../../shared/constants";
import type { PhysicsEngine } from "./physics-engine";
import type { VoxelGrid } from "./voxel-grid";

export class ElementEngine {
  private physics: PhysicsEngine;

  constructor(physics: PhysicsEngine) {
    this.physics = physics;
  }

  public tick(world: VoxelGrid, currentTick = 0): void {
    const width = world.width;
    const height = world.height;
    const depth = world.depth;

    const newFires: { x: number; y: number; z: number }[] = [];
    const extinguished: { x: number; y: number; z: number }[] = [];

    // Extremely simplified cellular automata for elements
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const v = world.get(x, y, z);
          if (!v) continue;

          if (v.material === "biomass") {
            const placedAt = v.metadata?.placedAt ?? currentTick;
            if (currentTick - placedAt >= BIOMASS_DECAY_TICKS) {
              world.set(x, y, z, {
                ...v,
                type: 10,
                material: "waste",
                metadata: {
                  ...(v.metadata ?? {}),
                  resourceQuality: 0,
                },
              });
            }
            continue;
          }

          if (v.material === "fire") {
            // Check neighbors for flammability
            const neighbors = [
              { dx: 1, dy: 0, dz: 0 },
              { dx: -1, dy: 0, dz: 0 },
              { dx: 0, dy: 1, dz: 0 },
              { dx: 0, dy: -1, dz: 0 },
              { dx: 0, dy: 0, dz: 1 },
              { dx: 0, dy: 0, dz: -1 },
            ];

            let fuelFound = false;

            for (const { dx, dy, dz } of neighbors) {
              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;
              const n = world.get(nx, ny, nz);

              if (n) {
                const flammability = this.physics.getMaterialProperty(n.material, "flammability");
                if (flammability > 0 && Math.random() < flammability * 0.1) {
                  // Spread probability
                  newFires.push({ x: nx, y: ny, z: nz });
                  fuelFound = true;
                }
              }
            }

            // If fire has no fuel or random chance, it dies
            if (!fuelFound && Math.random() < 0.2) {
              extinguished.push({ x, y, z });
            }
          }
        }
      }
    }

    // Apply element updates
    for (const pos of newFires) {
      const v = world.get(pos.x, pos.y, pos.z);
      if (v) {
        v.material = "fire";
        v.type = 8;
        v.temperature += 100;
        world.set(pos.x, pos.y, pos.z, v);
      }
    }

    for (const pos of extinguished) {
      const v = world.get(pos.x, pos.y, pos.z);
      if (v) {
        v.material = "air";
        v.type = 7;
        v.temperature = 20; // cools down
        world.set(pos.x, pos.y, pos.z, v);
      }
    }
  }
}
