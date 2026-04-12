import {
  AMBIENT_TEMPERATURE,
  BASE_SIGHT_RANGE,
  BASE_SMELL_RANGE,
  BASE_SOUND_RANGE,
  DARKNESS_SIGHT_FACTOR,
  DARKNESS_SIGHT_FLOOR,
  VOXEL_PERCEPTION_RADIUS,
} from "../../shared/constants";
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

export const SenseComputer = {
  computePerception(
    agent: AgentState,
    world: VoxelGrid,
    spatialIndex: SpatialIndex,
    _config: PerceptionConfig,
    circadianState: CircadianState,
    allVocalActuations: VocalActuation[],
  ): RawPercept {
    const actualSightRange =
      BASE_SIGHT_RANGE * (DARKNESS_SIGHT_FLOOR + DARKNESS_SIGHT_FACTOR * circadianState.lightLevel);
    const audibleRange = BASE_SOUND_RANGE;
    const smellableRange = BASE_SMELL_RANGE;

    // Use spatial index to get nearby agents up to max range
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
    // Gather voxels in perception radius
    for (let dx = -VOXEL_PERCEPTION_RADIUS; dx <= VOXEL_PERCEPTION_RADIUS; dx++) {
      for (let dy = -VOXEL_PERCEPTION_RADIUS; dy <= VOXEL_PERCEPTION_RADIUS; dy++) {
        for (let dz = -VOXEL_PERCEPTION_RADIUS; dz <= VOXEL_PERCEPTION_RADIUS; dz++) {
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
      localTemperature: AMBIENT_TEMPERATURE + circadianState.surfaceTemperatureDelta,
      lightLevel: circadianState.lightLevel,
      weather: "clear",
      vocalActuations: heardActuations,
    };
  },
};
