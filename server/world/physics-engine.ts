import type {
  BodyPart,
  BodyState,
  CircadianState,
  MaterialType,
  PhysicsPreset,
} from "../../shared/types";
import type { VoxelGrid } from "./voxel-grid";

export class PhysicsEngine {
  private preset: PhysicsPreset;

  constructor(preset: PhysicsPreset) {
    this.preset = preset;
  }

  public loadPreset(preset: PhysicsPreset): void {
    this.preset = preset;
  }

  public getGravity(): number {
    return this.preset.gravity;
  }

  public getMaterialProperty(
    material: MaterialType,
    property: "density" | "flammability" | "thermalConductivity",
  ): number {
    switch (property) {
      case "density":
        return this.preset.materialDensities[material];
      case "flammability":
        return this.preset.flammability[material];
      case "thermalConductivity":
        return this.preset.thermalConductivity[material];
    }
    return 0;
  }

  // Returns BodyState delta
  public applyGravityToAgent(
    agent: {
      position: { x: number; y: number; z: number };
      velocity?: { x: number; y: number; z: number };
    },
    world: VoxelGrid,
  ): Partial<BodyState> {
    // Simplified: check if voxel below is solid
    const { x, y, z } = agent.position;
    const voxelBelow = world.get(Math.floor(x), Math.floor(y) - 1, Math.floor(z));

    if (!voxelBelow || voxelBelow.material === "air" || voxelBelow.material === "water") {
      // Falling
      agent.velocity = agent.velocity || { x: 0, y: 0, z: 0 };
      agent.velocity.y -= this.getGravity() * 0.1; // simple integration
      return {};
    } else {
      // Landed
      if (agent.velocity && agent.velocity.y < -5) {
        const damage = this.calculateFallDamage(Math.abs(agent.velocity.y), 70);
        agent.velocity.y = 0;
        return { health: -damage };
      }
      if (agent.velocity) agent.velocity.y = 0;
      return {};
    }
  }

  public calculateTemperatureAt(
    x: number,
    y: number,
    z: number,
    world: VoxelGrid,
    circadianState: CircadianState,
  ): number {
    const voxel = world.get(x, y, z);
    const baseTemp = voxel ? voxel.temperature : this.preset.temperatureBaseline;

    // Check if surface: if voxel above is air or we are at top
    const voxelAbove = world.get(x, y + 1, z);
    const isSurface = !voxelAbove || voxelAbove.material === "air";

    if (isSurface) {
      return baseTemp + circadianState.surfaceTemperatureDelta;
    }
    return baseTemp;
  }

  public calculateFallDamage(velocity: number, mass: number): number {
    // KE = 1/2 m v^2
    const ke = 0.5 * mass * velocity * velocity;
    // Arbitrary scaling for game logic
    return Math.min(ke * 0.01, 100);
  }

  public calculateBodyPartDamage(impactForce: number, targetPart: BodyPart): Partial<BodyPart> {
    // Returns the delta
    const damageDelta = impactForce * 0.5;
    const painDelta = impactForce * 0.8;
    return {
      damage: Math.min(targetPart.damage + damageDelta, 100) - targetPart.damage,
      pain: Math.min(targetPart.pain + painDelta, 100) - targetPart.pain,
    };
  }
}
