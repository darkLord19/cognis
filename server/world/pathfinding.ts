import type { Vec3 } from "../../shared/types";
import type { VoxelGrid } from "./voxel-grid";

class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();

  constructor(private max: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const val = this.cache.get(key) as V;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V): void {
    if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, val);
  }
}

type Node = {
  x: number;
  y: number;
  z: number;
  g: number;
  f: number;
};

const DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];

function keyFor(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function parseKey(key: string): Vec3 {
  const parts = key.split(",");
  if (parts.length !== 3) {
    throw new Error(`Invalid pathfinding key: ${key}`);
  }

  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if ([x, y, z].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid pathfinding key: ${key}`);
  }

  return { x, y, z };
}

function heuristic(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz);
}

function isPassable(world: VoxelGrid, x: number, y: number, z: number): boolean {
  const voxel = world.get(x, y, z);
  return voxel === null || voxel.material === "air";
}

export class Pathfinding {
  private cache = new LRUCache<string, Vec3[]>(1000);

  public findPath(world: VoxelGrid, start: Vec3, end: Vec3): Vec3[] {
    const sx = Math.floor(start.x);
    const sy = Math.floor(start.y);
    const sz = Math.floor(start.z);
    const ex = Math.floor(end.x);
    const ey = Math.floor(end.y);
    const ez = Math.floor(end.z);

    const cacheKey = `${sx},${sy},${sz}->${ex},${ey},${ez}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.map((step) => ({ ...step }));
    }

    if (!world.inBounds(sx, sy, sz) || !world.inBounds(ex, ey, ez)) {
      return [];
    }

    if (sx === ex && sy === ey && sz === ez) {
      return [];
    }

    if (!isPassable(world, ex, ey, ez)) {
      return [];
    }

    const openList: Node[] = [
      {
        x: sx,
        y: sy,
        z: sz,
        g: 0,
        f: heuristic(sx, sy, sz, ex, ey, ez),
      },
    ];
    const cameFrom = new Map<string, string>();
    const bestCost = new Map<string, number>([[keyFor(sx, sy, sz), 0]]);

    while (openList.length > 0) {
      openList.sort((left, right) => left.f - right.f);
      const current = openList.shift();
      if (!current) {
        break;
      }

      if (current.x === ex && current.y === ey && current.z === ez) {
        const path: Vec3[] = [];
        let cursorKey = keyFor(ex, ey, ez);

        while (cursorKey !== keyFor(sx, sy, sz)) {
          path.push(parseKey(cursorKey));
          const parent = cameFrom.get(cursorKey);
          if (!parent) {
            break;
          }
          cursorKey = parent;
        }

        path.reverse();
        this.cache.set(cacheKey, path);
        return path.map((step) => ({ ...step }));
      }

      for (const [dx, dy, dz] of DIRECTIONS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;

        if (!world.inBounds(nx, ny, nz) || !isPassable(world, nx, ny, nz)) {
          continue;
        }

        const nextKey = keyFor(nx, ny, nz);
        const tentativeG = current.g + 1;
        const knownG = bestCost.get(nextKey);
        if (knownG !== undefined && tentativeG >= knownG) {
          continue;
        }

        cameFrom.set(nextKey, keyFor(current.x, current.y, current.z));
        bestCost.set(nextKey, tentativeG);
        openList.push({
          x: nx,
          y: ny,
          z: nz,
          g: tentativeG,
          f: tentativeG + heuristic(nx, ny, nz, ex, ey, ez),
        });
      }
    }

    this.cache.set(cacheKey, []);
    return [];
  }
}
