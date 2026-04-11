import type { AgentState, Vec3 } from "../../shared/types";

export class SpatialIndex {
  private cellSize: number;
  private buckets: Map<string, Set<string>> = new Map();
  private agents: Map<string, AgentState> = new Map();

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
  }

  private getBucketKey(x: number, y: number, z: number): string {
    const bx = Math.floor(x / this.cellSize);
    const by = Math.floor(y / this.cellSize);
    const bz = Math.floor(z / this.cellSize);
    return `${bx},${by},${bz}`;
  }

  public updateAgent(agent: AgentState): void {
    // Simplification: Assume agent doesn't jump huge distances
    // We should remove from old bucket and add to new.
    // For simplicity in this implementation, we just clear and rebuild or do a full O(N) re-bucket if needed,
    // or track agent's last bucket.
    this.agents.set(agent.id, agent);
    // Ideally we store lastBucketKey on agent or locally to efficiently update.
  }

  public rebuildIndex(agents: AgentState[]): void {
    this.buckets.clear();
    this.agents.clear();
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
      const key = this.getBucketKey(agent.position.x, agent.position.y, agent.position.z);
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(key, bucket);
      }
      bucket.add(agent.id);
    }
  }

  public getAgentsInRadius(position: Vec3, radius: number): AgentState[] {
    const result: AgentState[] = [];
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minY = position.y - radius;
    const maxY = position.y + radius;
    const minZ = position.z - radius;
    const maxZ = position.z + radius;

    for (let x = minX; x <= maxX; x += this.cellSize) {
      for (let y = minY; y <= maxY; y += this.cellSize) {
        for (let z = minZ; z <= maxZ; z += this.cellSize) {
          const key = this.getBucketKey(x, y, z);
          const bucket = this.buckets.get(key);
          if (bucket) {
            for (const id of bucket) {
              const agent = this.agents.get(id);
              if (agent) {
                // Distance check
                const dx = agent.position.x - position.x;
                const dy = agent.position.y - position.y;
                const dz = agent.position.z - position.z;
                if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                  result.push(agent);
                }
              }
            }
          }
        }
      }
    }

    // Remove duplicates if buckets overlap
    return Array.from(new Set(result));
  }
}
