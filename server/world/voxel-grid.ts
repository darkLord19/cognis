import type { MaterialType, Voxel, VoxelMetadata } from "../../shared/types";

// Enum to byte mapping for MaterialType
export const MaterialIds: Record<MaterialType, number> = {
  stone: 1,
  dirt: 2,
  wood: 3,
  water: 4,
  ore: 5,
  food: 6,
  air: 7,
  fire: 8,
};
export const IdToMaterial: Record<number, MaterialType> = Object.fromEntries(
  Object.entries(MaterialIds).map(([k, v]) => [v, k as MaterialType]),
);

export class VoxelGrid {
  public width: number;
  public depth: number;
  public height: number;

  // 1 byte type, 1 byte material, 4 bytes temp, 4 bytes moisture, 4 bytes fertility, 4 bytes light
  // Total 18 bytes per voxel. Let's align to 20 or 24 or use separate buffers.
  // Using Float32Array for all to make it easier: type(float), material(float), temp(float), etc.
  // 6 floats = 24 bytes per voxel.
  private buffer: SharedArrayBuffer;
  private data: Float32Array;
  private metadataMap: Map<number, VoxelMetadata> = new Map();

  private dirtyVoxels: Map<number, Voxel & { x: number; y: number; z: number }> = new Map();

  constructor(width: number, depth: number, height: number, buffer?: SharedArrayBuffer) {
    this.width = width;
    this.depth = depth;
    this.height = height;

    const floatsPerVoxel = 6;
    const numVoxels = width * depth * height;
    const byteLength = numVoxels * floatsPerVoxel * 4;

    this.buffer = buffer || new SharedArrayBuffer(byteLength);
    this.data = new Float32Array(this.buffer);
  }

  private getIndex(x: number, y: number, z: number): number {
    return x + y * this.width + z * this.width * this.height;
  }

  public inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  public get(x: number, y: number, z: number): Voxel | null {
    if (!this.inBounds(x, y, z)) return null;

    const idx = this.getIndex(x, y, z);
    const offset = idx * 6;

    const matId = this.data[offset + 1] ?? 0;
    if (matId === 0) return null; // Uninitialized

    const voxel: Voxel = {
      type: this.data[offset] ?? 0,
      material: IdToMaterial[matId] || "air",
      temperature: this.data[offset + 2] ?? 0,
      moisture: this.data[offset + 3] ?? 0,
      fertility: this.data[offset + 4] ?? 0,
      lightLevel: this.data[offset + 5] ?? 0,
    };

    if (this.metadataMap.has(idx)) {
      voxel.metadata = JSON.parse(JSON.stringify(this.metadataMap.get(idx))); // deep copy
    }

    return voxel;
  }

  public set(x: number, y: number, z: number, voxel: Voxel): void {
    if (!this.inBounds(x, y, z)) return;

    const idx = this.getIndex(x, y, z);
    const offset = idx * 6;

    this.data[offset] = voxel.type;
    this.data[offset + 1] = MaterialIds[voxel.material] || 0;
    this.data[offset + 2] = voxel.temperature;
    this.data[offset + 3] = voxel.moisture;
    this.data[offset + 4] = voxel.fertility;
    this.data[offset + 5] = voxel.lightLevel;

    if (voxel.metadata) {
      this.metadataMap.set(idx, JSON.parse(JSON.stringify(voxel.metadata)));
    } else {
      this.metadataMap.delete(idx);
    }

    this.dirtyVoxels.set(idx, { ...voxel, x, y, z });
  }

  public getLightLevel(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    const offset = this.getIndex(x, y, z) * 6;
    return this.data[offset + 5] ?? 0;
  }

  public getNeighbors(x: number, y: number, z: number): Voxel[] {
    const neighbors: Voxel[] = [];
    const dirs: [number, number, number][] = [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 1],
    ];

    for (const [dx, dy, dz] of dirs) {
      const vx = x + (dx as number);
      const vy = y + (dy as number);
      const vz = z + (dz as number);
      const v = this.get(vx, vy, vz);
      if (v) neighbors.push(v);
    }
    return neighbors;
  }

  public getDirtyVoxels(): (Voxel & { x: number; y: number; z: number })[] {
    return Array.from(this.dirtyVoxels.values());
  }

  public clearDirty(): void {
    this.dirtyVoxels.clear();
  }

  public getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }
}
