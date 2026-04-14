import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BodyPartId, SpeciesConfig } from "../../shared/types";
import type { ActuatorProfile } from "../agents/actuator-system";
import type { PhysiologyParams } from "../agents/physiology";
import { DEFAULT_ACTUATOR_PROFILE, type SpeciesActuatorProfile } from "./actuator-profile";
import { DEFAULT_METABOLISM_PROFILE, type MetabolismProfile } from "./metabolism-profile";
import { type SensoryApparatus, toLegacySenseProfile } from "./sensor-profile";

export type SpeciesDefinition = {
  id: string;
  operatorName: string;
  cognitiveTier: "full_llm" | "behavior_tree" | "pure_reflex";
  sensory: SensoryApparatus;
  actuators: ActuatorProfile;
  metabolism: PhysiologyParams;
  behavioralBiases: {
    curiosityBaseline: number;
    fearResponseThreshold: number;
    socialPull: number;
    oralExplorationBias: number;
    noveltyApproachBias: number;
  };
  qualiaProfile: {
    painSensitivityByPart: Record<BodyPartId, number>;
    tasteAcuity: number;
    bitterAversionStrength: number;
    thermalComfortBand: [number, number];
  };
};

function isSpeciesDefinition(value: unknown): value is SpeciesDefinition {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.operatorName === "string" &&
    typeof record.cognitiveTier === "string" &&
    typeof record.sensory === "object" &&
    typeof record.actuators === "object" &&
    typeof record.metabolism === "object"
  );
}

function defaultSleepConfig() {
  return {
    mode: "natural_sleep" as const,
    fatigueEnabled: true,
    fatigueRate: 0.05,
    recoveryRate: 0.1,
    minRestDuration: 50,
    maxWakeDuration: 400,
    cognitivePenaltyNoSleep: 0.3,
    emotionalPenaltyNoSleep: 0.2,
    healthPenaltyNoSleep: 0.1,
    consolidationDuringSleep: true,
    consolidationWhileAwake: false,
    consolidationIntervalTicks: 0,
    dreamsEnabled: true,
    nightmaresEnabled: true,
    sleepSchedule: "individual" as const,
  };
}

function toLegacyConfig(definition: SpeciesDefinition): SpeciesConfig {
  const cognitiveTier =
    definition.cognitiveTier === "behavior_tree" ? "pure_reflex" : definition.cognitiveTier;
  return {
    id: definition.id,
    name: definition.operatorName,
    cognitiveTier,
    senseProfile: toLegacySenseProfile(definition.sensory),
    emotionalFieldEnabled: true,
    socialCapacity: definition.behavioralBiases.socialPull >= 0.45 ? "full" : "limited",
    canLearnLanguage: cognitiveTier === "full_llm",
    canBedomesticated: false,
    baseStats: {
      maxHealth: 100,
      speed: Math.max(1, definition.actuators.movementSpeed * 10),
      strength: Math.max(1, definition.actuators.biteForce * 10),
      metabolism: 1,
      reachRange: Math.max(1, definition.actuators.maxReachVoxels),
      lifespanTicks: 50000,
      reproductionAge: 10000,
      gestationTicks: 2000,
    },
    muscleStatRanges: {
      strength: [0.3, 0.9],
      speed: [0.3, 0.9],
      endurance: [0.3, 0.9],
    },
    dnaTraits: [],
    threatLevel: Math.max(0.1, Math.min(1, definition.behavioralBiases.fearResponseThreshold)),
    ecologicalRole: "neutral",
    sleepConfig: defaultSleepConfig(),
    memoryConfig: {},
    survivalDriveWeight: 0.8,
    circadianSensitivity: 0.8,
  };
}

function toDefinition(config: SpeciesConfig): SpeciesDefinition {
  const sensory: SensoryApparatus = {
    visionRange: config.senseProfile.sight,
    auditionRange: config.senseProfile.sound,
    olfactionRange: config.senseProfile.smell,
    empathicRange: config.senseProfile.empath,
    tasteAcuity: 0.5,
  };
  const actuators: SpeciesActuatorProfile = {
    ...DEFAULT_ACTUATOR_PROFILE,
    movementSpeed: Math.max(0.5, config.baseStats.speed / 10),
    maxReachVoxels: config.baseStats.reachRange || DEFAULT_ACTUATOR_PROFILE.maxReachVoxels,
  };
  const metabolism: MetabolismProfile = { ...DEFAULT_METABOLISM_PROFILE };

  return {
    id: config.id,
    operatorName: config.name,
    cognitiveTier: config.cognitiveTier,
    sensory,
    actuators,
    metabolism,
    behavioralBiases: {
      curiosityBaseline: 0.5,
      fearResponseThreshold: config.threatLevel,
      socialPull:
        config.socialCapacity === "full" ? 0.7 : config.socialCapacity === "limited" ? 0.4 : 0.1,
      oralExplorationBias: 0.5,
      noveltyApproachBias: 0.5,
    },
    qualiaProfile: {
      painSensitivityByPart: {
        head: 1,
        torso: 1,
        leftArm: 1,
        rightArm: 1,
        leftLeg: 1,
        rightLeg: 1,
      },
      tasteAcuity: 0.5,
      bitterAversionStrength: 0.6,
      thermalComfortBand: [16, 28],
    },
  };
}

export class SpeciesRegistry {
  private species = new Map<string, SpeciesConfig>();
  private definitions = new Map<string, SpeciesDefinition>();

  public loadAll(): void {
    this.species.clear();
    this.definitions.clear();

    const dir = join(process.cwd(), "data/species");
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const parsed = JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown;

      if (isSpeciesDefinition(parsed)) {
        this.definitions.set(parsed.id, parsed);
        this.species.set(parsed.id, toLegacyConfig(parsed));
        continue;
      }

      const legacy = parsed as SpeciesConfig;
      this.species.set(legacy.id, legacy);
      this.definitions.set(legacy.id, toDefinition(legacy));
    }
  }

  public get(id: string): SpeciesConfig | undefined {
    return this.species.get(id);
  }

  public getAll(): SpeciesConfig[] {
    return Array.from(this.species.values());
  }

  public getDefinition(id: string): SpeciesDefinition | undefined {
    return this.definitions.get(id);
  }

  public getDefinitions(): SpeciesDefinition[] {
    return Array.from(this.definitions.values());
  }
}
