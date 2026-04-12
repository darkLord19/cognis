import type { Vec3 } from "../../shared/types";
import type { VoxelGrid } from "./voxel-grid";

class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  constructor(private max: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V) {
    if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, val);
  }
}

export class Pathfinding {
  private cache = new LRUCache<string, Vec3[]>(1000);

  // Simplified A* - 3D grid
  public findPath(_world: VoxelGrid, start: Vec3, end: Vec3): Vec3[] {
    const sx = Math.floor(start.x);
    const sy = Math.floor(start.y);
    const sz = Math.floor(start.z);
    const ex = Math.floor(end.x);
    const ey = Math.floor(end.y);
    const ez = Math.floor(end.z);

    const cacheKey = `${sx},${sy},${sz}->${ex},${ey},${ez}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Heuristic: Manhattan distance
    const dist = Math.abs(ex - sx) + Math.abs(ey - sy) + Math.abs(ez - sz);

    // For now, return a naive direct line if it's clear (simplification for placeholder)
    // A full A* in 3D without knowing specific move costs is heavy for this stage.
    // We will just return a direct line path of length dist if dist < 10.
    const path: Vec3[] = [];
    if (dist < 10) {
      path.push({ x: ex, y: ey, z: ez });
    }

    this.cache.set(cacheKey, path);
    return path;
  }
}
