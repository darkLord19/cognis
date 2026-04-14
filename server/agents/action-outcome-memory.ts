import type { ActionOutcomeRecord } from "../../shared/types";

/**
 * ActionOutcomeMemory stores the subjective physics of an agent's experiences.
 * It tracks what happened after specific actions were taken in specific contexts.
 */
export class ActionOutcomeMemory {
  private records: ActionOutcomeRecord[] = [];
  private readonly MAX_RECORDS = 1000;

  /**
   * Records the outcome of an action.
   */
  public record(record: ActionOutcomeRecord): void {
    this.records.push(record);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.shift();
    }
  }

  /**
   * Returns recent outcomes for a specific action type.
   */
  public getOutcomesFor(actionType: string): ActionOutcomeRecord[] {
    return this.records.filter((r) => r.actionType === actionType);
  }

  /**
   * Finds records with similar context signatures.
   */
  public findSimilarContexts(signature: string): ActionOutcomeRecord[] {
    // Simple exact match for now; clustering can be added later
    return this.records.filter((r) => r.contextSignature === signature);
  }

  public getAll(): ActionOutcomeRecord[] {
    return [...this.records];
  }

  public clear(): void {
    this.records = [];
  }
}
