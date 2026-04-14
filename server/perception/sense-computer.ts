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
  AudioFieldSample,
  CircadianState,
  PerceptionConfig,
  PerceptualRef,
  RawPercept,
  RawSensorBundle,
  VocalActuation,
  Voxel,
} from "../../shared/types";
import { SENSOR_BUNDLE_LENGTH, SensorIndex, SensorSchemaVersion } from "../../shared/types";
import {
  computeChestPressure,
  computeOralDryness,
  computeVisceralContraction,
} from "../agents/physiology";
import { V1_MATERIALS } from "../world/material-affordances";
import type { SpatialIndex } from "../world/spatial-index";
import type { VoxelGrid } from "../world/voxel-grid";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeThermalStress(coreTemperature: number, localTemperature: number): number {
  return clamp01(Math.abs(coreTemperature - localTemperature) / 20);
}

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
    const heardActuations: VocalActuation[] = [];
    const audioField: AudioFieldSample[] = [];
    for (const va of allVocalActuations) {
      if (va.emitterId === agent.id) continue;
      const emitter = nearbyAgents.find((a) => a.id === va.emitterId);
      if (!emitter) continue;
      const dist = Math.sqrt(
        (emitter.position.x - agent.position.x) ** 2 +
          (emitter.position.y - agent.position.y) ** 2 +
          (emitter.position.z - agent.position.z) ** 2,
      );
      if (dist > audibleRange) continue;
      heardActuations.push(va);
      const amplitude = Math.max(0, 1 - dist / audibleRange);
      audioField.push({
        emitterId: va.emitterId,
        soundToken: va.soundToken,
        amplitude,
        valence: va.valence,
        arousal: va.arousal,
      });
    }

    return {
      visibleAgents,
      audibleAgents,
      smellableAgents,
      nearbyVoxels,
      localTemperature: AMBIENT_TEMPERATURE + circadianState.surfaceTemperatureDelta,
      lightLevel: circadianState.lightLevel,
      weather: "clear",
      audioField,
      vocalActuations: heardActuations,
    };
  },

  computeSensorBundle(
    agent: AgentState,
    world: VoxelGrid,
    spatialIndex: SpatialIndex,
    config: PerceptionConfig,
    circadianState: CircadianState,
    allVocalActuations: VocalActuation[],
    tick = 0,
  ): RawSensorBundle {
    const raw = this.computePerception(
      agent,
      world,
      spatialIndex,
      config,
      circadianState,
      allVocalActuations,
    );
    const readings = new Float32Array(SENSOR_BUNDLE_LENGTH);

    const physiology = agent.body.physiology ?? {
      energyReserves: agent.body.energy,
      hydration: agent.body.hydration,
      oxygenSaturation: agent.body.oxygenation,
      fatigue: agent.body.fatigue,
      coreTemperature: agent.body.coreTemperature,
    };

    readings[SensorIndex.VisualBand0] = clamp01(raw.visibleAgents.length / 5);
    readings[SensorIndex.VisualBand1] = clamp01(
      raw.nearbyVoxels.filter((voxel) => voxel.material === "water").length / 3,
    );
    readings[SensorIndex.VisualBand2] = clamp01(
      raw.nearbyVoxels.filter((voxel) => voxel.material === "biomass").length / 3,
    );
    readings[SensorIndex.VisualMotion] = clamp01(raw.visibleAgents.length / 5);

    readings[SensorIndex.OlfactoryOrganic] = clamp01(raw.smellableAgents.length / 5);
    readings[SensorIndex.OlfactoryThreat] = clamp01(
      raw.smellableAgents.filter((other) => (other.body.integrityDrive ?? 0) > 0.7).length / 3,
    );
    readings[SensorIndex.OlfactoryDecay] = clamp01(
      raw.nearbyVoxels.filter((voxel) => voxel.material === "waste").length / 3,
    );

    const loudest = Math.max(0, ...raw.audioField.map((sample) => sample.amplitude));
    readings[SensorIndex.AuditoryBand0] = clamp01(loudest);
    readings[SensorIndex.AuditoryBand1] = clamp01(raw.audioField.length / 3);
    readings[SensorIndex.AuditoryBand2] = clamp01(
      raw.audioField.filter((sample) => sample.valence < -0.2).length / 3,
    );

    readings[SensorIndex.AmbientThermalDeviation] = computeThermalStress(
      physiology.coreTemperature,
      raw.localTemperature,
    );
    readings[SensorIndex.RadiantHeat] = clamp01(
      raw.nearbyVoxels.filter((voxel) => voxel.material === "fire").length / 3,
    );

    readings[SensorIndex.VisceralContraction] = computeVisceralContraction(
      physiology.energyReserves,
    );
    readings[SensorIndex.OralDryness] = computeOralDryness(physiology.hydration);
    readings[SensorIndex.ChestPressure] = computeChestPressure(physiology.oxygenSaturation);
    readings[SensorIndex.MuscleWeakness] = clamp01(physiology.fatigue);
    readings[SensorIndex.CoreThermalStress] = computeThermalStress(
      physiology.coreTemperature,
      raw.localTemperature,
    );

    readings[SensorIndex.PainHead] = agent.body.bodyMap.head.pain;
    readings[SensorIndex.PainTorso] = agent.body.bodyMap.torso.pain;
    readings[SensorIndex.PainLeftArm] = agent.body.bodyMap.leftArm.pain;
    readings[SensorIndex.PainRightArm] = agent.body.bodyMap.rightArm.pain;
    readings[SensorIndex.PainLeftLeg] = agent.body.bodyMap.leftLeg.pain;
    readings[SensorIndex.PainRightLeg] = agent.body.bodyMap.rightLeg.pain;

    readings[SensorIndex.CycleFlux] = clamp01(agent.body.cycleFlux ?? agent.body.cycleHormone);
    readings[SensorIndex.SocialIsolation] = clamp01(1 - Math.min(1, raw.visibleAgents.length / 3));

    if (agent.body.mouthItem) {
      const material = V1_MATERIALS[agent.body.mouthItem.materialId];
      readings[SensorIndex.Taste0] = material?.tasteProfile?.channel0 ?? 0;
      readings[SensorIndex.Taste1] = material?.tasteProfile?.channel1 ?? 0;
      readings[SensorIndex.Taste2] = material?.tasteProfile?.channel2 ?? 0;
      readings[SensorIndex.Taste3] = material?.tasteProfile?.channel3 ?? 0;
      readings[SensorIndex.Taste4] = material?.tasteProfile?.channel4 ?? 0;
    }

    const perceptualRefs: PerceptualRef[] = raw.visibleAgents.slice(0, 6).map((entity, index) => {
      const dx = entity.position.x - agent.position.x;
      const dz = entity.position.z - agent.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const approximateDirection =
        Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? "front" : "behind") : dz >= 0 ? "right" : "left";

      return {
        ref: `foreground_${index}`,
        kind: "visible_entity",
        operatorEntityId: entity.id,
        approximateDirection,
        salience: clamp01(1 / Math.max(1, distance)),
      };
    });

    if (agent.body.mouthItem) {
      perceptualRefs.push({
        ref: "mouth_item",
        kind: "mouth_item",
        operatorMaterialId: agent.body.mouthItem.materialId,
        salience: 1,
      });
    }

    perceptualRefs.push({
      ref: "self",
      kind: "self",
      salience: 1,
    });

    return {
      schemaVersion: SensorSchemaVersion.V1,
      agentId: agent.id,
      tick,
      readings,
      perceptualRefs,
    };
  },
};
