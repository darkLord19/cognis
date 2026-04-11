import type { CircadianConfig, CircadianState, SeasonType } from "../../shared/types";
import type { VoxelGrid } from "./voxel-grid";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class CircadianEngine {
  public static tick(
    currentTick: number,
    world: VoxelGrid,
    config: CircadianConfig,
  ): CircadianState {
    if (!config.enabled) {
      return {
        lightLevel: 1.0,
        surfaceTemperatureDelta: 0.0,
        cycleHormoneValue: 0.0,
        season: "spring",
      };
    }

    const lightLevel = CircadianEngine.computeLightLevel(currentTick, config);
    const surfaceTemperatureDelta = CircadianEngine.computeSurfaceTemperature(lightLevel, config);
    const cycleHormoneValue = CircadianEngine.computeCycleHormone(lightLevel, config);
    const season = CircadianEngine.computeSeason(currentTick, config);

    CircadianEngine.updateWorldLighting(world, lightLevel);

    return {
      lightLevel,
      surfaceTemperatureDelta,
      cycleHormoneValue,
      season,
    };
  }

  public static computeLightLevel(tick: number, config: CircadianConfig): number {
    const phase = (tick % config.cycleLengthTicks) / config.cycleLengthTicks;

    if (config.lightCurve === "step") {
      return phase < 0.5 ? 1.0 : 0.0;
    } else {
      // sine curve: peaks at 1.0 when phase is 0.25, valleys at 0.0 when phase is 0.75
      // 0.5 * sin(2 * PI * phase - PI/2) + 0.5
      return 0.5 * Math.sin(2 * Math.PI * phase - Math.PI / 2) + 0.5;
    }
  }

  public static computeSurfaceTemperature(lightLevel: number, config: CircadianConfig): number {
    // delta shifts from -delta/2 (dark) to +delta/2 (light)
    return (lightLevel - 0.5) * config.temperatureDelta;
  }

  public static computeCycleHormone(lightLevel: number, config: CircadianConfig): number {
    if (!config.cycleHormoneEnabled) return 0.0;
    // Inverse of lightLevel (peaks when dark)
    return 1.0 - lightLevel;
  }

  public static computeSeason(tick: number, config: CircadianConfig): SeasonType {
    if (!config.seasonEnabled || config.seasonLengthCycles <= 0) return "spring";

    const cycle = Math.floor(tick / config.cycleLengthTicks);
    const seasonPhase = (cycle % config.seasonLengthCycles) / config.seasonLengthCycles;

    if (seasonPhase < 0.25) return "spring";
    if (seasonPhase < 0.5) return "summer";
    if (seasonPhase < 0.75) return "autumn";
    return "winter";
  }

  public static updateWorldLighting(world: VoxelGrid, lightLevel: number): void {
    // Top-down search for surface voxels
    for (let x = 0; x < world.width; x++) {
      for (let z = 0; z < world.depth; z++) {
        let surfaceFound = false;
        // Start from top to bottom
        for (let y = world.height - 1; y >= 0; y--) {
          const v = world.get(x, y, z);
          if (v && v.material !== "air") {
            if (!surfaceFound) {
              v.lightLevel = lightLevel;
              world.set(x, y, z, v);
              surfaceFound = true;
            } else {
              // Below surface, maybe light attenuates? The PRD just says "update lightLevel on all surface voxels"
              // We'll leave underground voxels alone or set them to 0.
              // We'll just leave them since terrain generation already sets them properly.
              break;
            }
          }
        }
      }
    }
  }
}
