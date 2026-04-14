import type { ActionOutcomeRecord as LegacyActionOutcomeRecord } from "../../shared/types";
import type { ActuationType, MotorPlan } from "./action-grammar";

export type OutcomeSignature = {
  deltaVisceralContraction: number;
  deltaOralDryness: number;
  deltaPain: number;
  deltaToxinLoad: number;
  deltaHealth: number;
  deltaArousal: number;
  reliefScore: number;
  harmScore: number;
};

export type ActionOutcomeRecord = {
  agentId: string;
  tick: number;
  cueSignature: string;
  motorPlan: MotorPlan;
  targetRef?: string;
  outcome: OutcomeSignature;
  success: boolean;
};

function fromLegacy(record: LegacyActionOutcomeRecord): ActionOutcomeRecord {
  const reliefScore = Math.max(0, record.deltaHydration) + Math.max(0, record.deltaEnergy);
  const harmScore =
    Math.max(0, record.deltaPain) +
    Math.max(0, record.deltaToxin) +
    Math.max(0, record.deltaThreat);

  const normalized: ActionOutcomeRecord = {
    agentId: "legacy-agent",
    tick: record.tick,
    cueSignature: record.contextSignature,
    motorPlan: {
      source: "procedural",
      urgency: 0.5,
      createdAtTick: record.tick,
      primitives: [
        {
          type: record.actionType.toLowerCase() as ActuationType,
          target: record.targetSignature
            ? { type: "perceptual_ref", ref: record.targetSignature }
            : { type: "none" },
          intensity: 0.5,
          durationTicks: 1,
        },
      ],
      reason: "legacy_record",
    },
    outcome: {
      deltaVisceralContraction: -record.deltaEnergy,
      deltaOralDryness: -record.deltaHydration,
      deltaPain: record.deltaPain,
      deltaToxinLoad: record.deltaToxin,
      deltaHealth: -record.deltaThreat,
      deltaArousal: 0,
      reliefScore,
      harmScore,
    },
    success: record.success,
  };
  if (record.targetSignature) {
    normalized.targetRef = record.targetSignature;
  }
  return normalized;
}

export class ActionOutcomeMemory {
  private records: ActionOutcomeRecord[] = [];
  private readonly MAX_RECORDS = 2000;

  public record(record: ActionOutcomeRecord | LegacyActionOutcomeRecord): void {
    const normalized = "cueSignature" in record ? record : fromLegacy(record);
    this.records.push(normalized);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.shift();
    }
  }

  public findSimilar(cueSignature: string, limit: number): ActionOutcomeRecord[] {
    return this.records.filter((record) => record.cueSignature === cueSignature).slice(-limit);
  }

  // Compatibility wrappers used by existing policy code during migration.
  public findSimilarContexts(signature: string): LegacyActionOutcomeRecord[] {
    return this.findSimilar(signature, 64).map((record) => {
      const legacy: LegacyActionOutcomeRecord = {
        contextSignature: record.cueSignature,
        actionType: (record.motorPlan.primitives[0]?.type.toUpperCase() ??
          "DEFER") as LegacyActionOutcomeRecord["actionType"],
        deltaPain: record.outcome.deltaPain,
        deltaHydration: -record.outcome.deltaOralDryness,
        deltaEnergy: -record.outcome.deltaVisceralContraction,
        deltaToxin: record.outcome.deltaToxinLoad,
        deltaThreat: Math.max(0, -record.outcome.deltaHealth),
        success: record.success,
        tick: record.tick,
      };
      if (record.targetRef) {
        legacy.targetSignature = record.targetRef;
      }
      return legacy;
    });
  }

  public getOutcomesFor(actionType: string): LegacyActionOutcomeRecord[] {
    return this.records
      .filter((record) =>
        record.motorPlan.primitives.some(
          (primitive) => primitive.type.toUpperCase() === actionType.toUpperCase(),
        ),
      )
      .map((record) => {
        const legacy: LegacyActionOutcomeRecord = {
          contextSignature: record.cueSignature,
          actionType: actionType as LegacyActionOutcomeRecord["actionType"],
          deltaPain: record.outcome.deltaPain,
          deltaHydration: -record.outcome.deltaOralDryness,
          deltaEnergy: -record.outcome.deltaVisceralContraction,
          deltaToxin: record.outcome.deltaToxinLoad,
          deltaThreat: Math.max(0, -record.outcome.deltaHealth),
          success: record.success,
          tick: record.tick,
        };
        if (record.targetRef) {
          legacy.targetSignature = record.targetRef;
        }
        return legacy;
      });
  }

  public getAll(): ActionOutcomeRecord[] {
    return [...this.records];
  }

  public clear(): void {
    this.records = [];
  }
}
