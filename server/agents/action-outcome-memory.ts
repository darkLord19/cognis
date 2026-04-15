import type { ActionOutcomeRecord as LegacyActionOutcomeRecord } from "../../shared/types";
import { db } from "../persistence/database";
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

type PersistenceContext = {
  runId: string;
  branchId: string;
};

function recordSignature(record: ActionOutcomeRecord): string {
  const firstPrimitive = record.motorPlan.primitives[0];
  return [
    record.agentId,
    record.tick,
    record.cueSignature,
    record.targetRef ?? "",
    firstPrimitive?.type ?? "",
    firstPrimitive?.target.type ?? "",
  ].join("::");
}

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
  constructor(private persistence?: PersistenceContext) {}

  private persist(record: ActionOutcomeRecord): void {
    if (!this.persistence) {
      return;
    }

    db.insertProceduralOutcome({
      runId: this.persistence.runId,
      branchId: this.persistence.branchId,
      agentId: record.agentId,
      tick: record.tick,
      cueSignature: record.cueSignature,
      ...(record.targetRef ? { targetSignature: record.targetRef } : {}),
      motorPlanJson: JSON.stringify(record.motorPlan),
      deltaVisceralContraction: record.outcome.deltaVisceralContraction,
      deltaOralDryness: record.outcome.deltaOralDryness,
      deltaPain: record.outcome.deltaPain,
      deltaToxinLoad: record.outcome.deltaToxinLoad,
      deltaHealth: record.outcome.deltaHealth,
      reliefScore: record.outcome.reliefScore,
      harmScore: record.outcome.harmScore,
      success: record.success,
      merkleHash: db.getLastAuditHash(this.persistence.branchId),
    });
  }

  private append(record: ActionOutcomeRecord): void {
    this.records.push(record);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.shift();
    }
  }

  public remember(
    record: ActionOutcomeRecord | LegacyActionOutcomeRecord,
    options: { persist?: boolean } = { persist: true },
  ): void {
    const normalized = "cueSignature" in record ? record : fromLegacy(record);
    this.append(normalized);
    if (options.persist !== false) {
      this.persist(normalized);
    }
  }

  public record(record: ActionOutcomeRecord | LegacyActionOutcomeRecord): void {
    this.remember(record, { persist: true });
  }

  public hydrate(agentId: string, limit = 400): ActionOutcomeRecord[] {
    if (!this.persistence) {
      return [];
    }

    const rows = db.getProceduralOutcomes(
      this.persistence.runId,
      this.persistence.branchId,
      agentId,
      limit,
    );
    const records = rows
      .map((row) => {
        let motorPlan: MotorPlan | null = null;
        try {
          motorPlan = JSON.parse(row.motor_plan_json) as MotorPlan;
        } catch {
          return null;
        }

        const normalized: ActionOutcomeRecord = {
          agentId: row.agent_id,
          tick: row.tick,
          cueSignature: row.cue_signature,
          motorPlan,
          outcome: {
            deltaVisceralContraction: row.delta_visceral_contraction,
            deltaOralDryness: row.delta_oral_dryness,
            deltaPain: row.delta_pain,
            deltaToxinLoad: row.delta_toxin_load,
            deltaHealth: row.delta_health,
            deltaArousal: 0,
            reliefScore: row.relief_score,
            harmScore: row.harm_score,
          },
          success: row.success === 1,
        };
        if (row.target_signature) {
          normalized.targetRef = row.target_signature;
        }
        return normalized;
      })
      .filter((record): record is ActionOutcomeRecord => Boolean(record));

    const seen = new Set(this.records.map((record) => recordSignature(record)));
    for (const record of records) {
      const signature = recordSignature(record);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      this.remember(record, { persist: false });
    }

    return records;
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
