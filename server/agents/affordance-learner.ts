import type { ActuationType } from "./action-grammar";
import type {
  ActionOutcomeMemory,
  ActionOutcomeRecord,
  OutcomeSignature,
} from "./action-outcome-memory";

export type LearnedAffordance = {
  agentId: string;
  cueSignature: string;
  targetSignature: string;
  motorPrimitiveType: ActuationType;
  expectedOutcome: OutcomeSignature;
  confidence: number;
  attempts: number;
  successes: number;
  failures: number;
  lastUpdatedTick: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function buildKey(input: {
  agentId: string;
  cueSignature: string;
  targetSignature: string;
  motorPrimitiveType: ActuationType;
}): string {
  return `${input.agentId}::${input.cueSignature}::${input.targetSignature}::${input.motorPrimitiveType}`;
}

function mergeOutcome(oldValue: OutcomeSignature, nextValue: OutcomeSignature): OutcomeSignature {
  const mix = 0.7;
  const blend = (a: number, b: number) => a * mix + b * (1 - mix);
  return {
    deltaVisceralContraction: blend(
      oldValue.deltaVisceralContraction,
      nextValue.deltaVisceralContraction,
    ),
    deltaOralDryness: blend(oldValue.deltaOralDryness, nextValue.deltaOralDryness),
    deltaPain: blend(oldValue.deltaPain, nextValue.deltaPain),
    deltaToxinLoad: blend(oldValue.deltaToxinLoad, nextValue.deltaToxinLoad),
    deltaHealth: blend(oldValue.deltaHealth, nextValue.deltaHealth),
    deltaArousal: blend(oldValue.deltaArousal, nextValue.deltaArousal),
    reliefScore: blend(oldValue.reliefScore, nextValue.reliefScore),
    harmScore: blend(oldValue.harmScore, nextValue.harmScore),
  };
}

export class AffordanceLearner {
  private affordances = new Map<string, LearnedAffordance>();

  constructor(private memory: ActionOutcomeMemory) {}

  private applyOutcome(
    record: ActionOutcomeRecord,
    options: { remember?: boolean } = { remember: true },
  ): LearnedAffordance | null {
    const primary = record.motorPlan.primitives[0];
    if (!primary) return null;

    const key = buildKey({
      agentId: record.agentId,
      cueSignature: record.cueSignature,
      targetSignature: record.targetRef ?? "unknown",
      motorPrimitiveType: primary.type,
    });
    const previous = this.affordances.get(key);

    const outcomeScore =
      record.outcome.reliefScore -
      record.outcome.harmScore -
      Math.max(0, record.outcome.deltaToxinLoad);
    const confidence = clamp01((previous?.confidence ?? 0.3) * 0.85 + sigmoid(outcomeScore) * 0.15);

    const next: LearnedAffordance = {
      agentId: record.agentId,
      cueSignature: record.cueSignature,
      targetSignature: record.targetRef ?? "unknown",
      motorPrimitiveType: primary.type,
      expectedOutcome: previous
        ? mergeOutcome(previous.expectedOutcome, record.outcome)
        : record.outcome,
      confidence,
      attempts: (previous?.attempts ?? 0) + 1,
      successes: (previous?.successes ?? 0) + (record.success ? 1 : 0),
      failures: (previous?.failures ?? 0) + (record.success ? 0 : 1),
      lastUpdatedTick: record.tick,
    };

    this.affordances.set(key, next);
    if (options.remember !== false) {
      this.memory.record(record);
    }
    return next;
  }

  public updateFromOutcome(record: ActionOutcomeRecord): LearnedAffordance | null {
    return this.applyOutcome(record, { remember: true });
  }

  public replay(records: ActionOutcomeRecord[]): number {
    let applied = 0;
    for (const record of records) {
      if (this.applyOutcome(record, { remember: false })) {
        applied++;
      }
    }
    return applied;
  }

  public getCandidates(cueSignature: string): LearnedAffordance[] {
    return [...this.affordances.values()]
      .filter((entry) => entry.cueSignature === cueSignature)
      .sort((a, b) => b.confidence - a.confidence);
  }

  public getAllAffordances(): LearnedAffordance[] {
    return [...this.affordances.values()].sort((a, b) => b.confidence - a.confidence);
  }

  // Compatibility adapters for existing procedural policy call sites.
  public getLearnedValue(
    contextSignature: string,
    actionType: string,
  ): { confidence: number; utility: number; expectations: Partial<ActionOutcomeRecord> } {
    const candidate = this.getCandidates(contextSignature).find(
      (entry) => entry.motorPrimitiveType.toUpperCase() === actionType.toUpperCase(),
    );

    if (!candidate) {
      return { confidence: 0, utility: 0, expectations: {} };
    }

    const utility =
      candidate.expectedOutcome.reliefScore -
      candidate.expectedOutcome.harmScore -
      candidate.expectedOutcome.deltaToxinLoad;

    return {
      confidence: candidate.confidence,
      utility,
      expectations: {},
    };
  }

  public findBestAction(
    contextSignature: string,
    availableActions: string[],
  ): { actionType: string; utility: number; confidence: number } | null {
    const candidates = this.getCandidates(contextSignature).filter((entry) =>
      availableActions.some(
        (action) => action.toUpperCase() === entry.motorPrimitiveType.toUpperCase(),
      ),
    );
    const best = candidates[0];
    if (!best) return null;
    const utility =
      best.expectedOutcome.reliefScore -
      best.expectedOutcome.harmScore -
      best.expectedOutcome.deltaToxinLoad;
    return {
      actionType: best.motorPrimitiveType.toUpperCase(),
      utility,
      confidence: best.confidence,
    };
  }
}
