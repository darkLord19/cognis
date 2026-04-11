import type {
  AgentState,
  CircadianState,
  PerceptionConfig,
  RawPercept,
  VocalActuation,
  Voxel,
} from "../../shared/types";
import type { SpatialIndex } from "../world/spatial-index";
import type { VoxelGrid } from "../world/voxel-grid";

export class SenseComputer {
  public static computePerception(
    agent: AgentState,
    world: VoxelGrid,
    spatialIndex: SpatialIndex,
    config: PerceptionConfig,
    circadianState: CircadianState,
    allVocalActuations: VocalActuation[],
  ): RawPercept {
    // Simplify sense profile. Assume human profile if not found (just for demo/tests)
    // The actual system should lookup species profile, but we just hardcode basic ranges here
    // or assume AgentState has speciesId we can lookup.
    // For now, let's use fixed base ranges and multiply by light level for sight.
    const baseSightRange = 30;
    const baseSoundRange = 50;
    const baseSmellRange = 15;

    const actualSightRange = baseSightRange * (0.2 + 0.8 * circadianState.lightLevel); // Darkness reduces sight
    const audibleRange = baseSoundRange;
    const smellableRange = baseSmellRange;

    // We can use spatial index to get nearby agents up to max range
    const maxRange = Math.max(actualSightRange, audibleRange, smellableRange);
    const nearbyAgents = spatialIndex.getAgentsInRadius(agent.position, maxRange);

    const visibleAgents = [];
    const audibleAgents = [];
    const smellableAgents = [];

    for (const other of nearbyAgents) {
      if (other.id === agent.id) continue;

      const dx = other.position.x - agent.position.x;
      const dy = other.position.y - agent.position.y;
      const dz = other.position.z - agent.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= actualSightRange) visibleAgents.push(other);
      if (dist <= audibleRange) audibleAgents.push(other);
      if (dist <= smellableRange) smellableAgents.push(other);
    }

    const nearbyVoxels: Voxel[] = [];
    // gather voxels in a tiny radius (e.g. 2)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          const v = world.get(
            Math.floor(agent.position.x) + dx,
            Math.floor(agent.position.y) + dy,
            Math.floor(agent.position.z) + dz,
          );
          if (v) nearbyVoxels.push(v);
        }
      }
    }

    // Filter vocal actuations by audible range
    const heardActuations = allVocalActuations.filter((va) => {
      if (va.emitterId === agent.id) return false;
      const emitter = nearbyAgents.find((a) => a.id === va.emitterId);
      if (!emitter) return false;
      const dist = Math.sqrt(
        (emitter.position.x - agent.position.x) ** 2 +
          (emitter.position.y - agent.position.y) ** 2 +
          (emitter.position.z - agent.position.z) ** 2,
      );
      return dist <= audibleRange;
    });

    return {
      visibleAgents,
      audibleAgents,
      smellableAgents,
      nearbyVoxels,
      localTemperature: 15 + circadianState.surfaceTemperatureDelta, // placeholder
      lightLevel: circadianState.lightLevel,
      weather: "clear",
      vocalActuations: heardActuations,
    };
  }
}
