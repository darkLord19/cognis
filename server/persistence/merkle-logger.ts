import type { AuditLogEntry } from "../../shared/types";
import { db } from "./database";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class MerkleLogger {
  private static hash(data: string): string {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(data);
    return hasher.digest("hex");
  }

  public static log(
    tick: number,
    branchId: string,
    agentId: string | null,
    system: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    causeEventId: string | null,
  ): void {
    const previousHash = db.getLastAuditHash(branchId);
    const data = `${previousHash}${tick}${agentId || ""}${field}${oldValue || ""}${newValue || ""}`;
    const entryHash = MerkleLogger.hash(data);

    db.insertAuditLog({
      tick,
      branchId,
      agentId,
      system,
      field,
      oldValue,
      newValue,
      causeEventId,
      causeDescription: null,
      suppressed: false,
      previousHash,
      entryHash,
    });
  }

  public static logSuppression(
    agentId: string,
    branchId: string,
    field: string,
    suppressedValue: string,
    tick: number,
  ): void {
    const previousHash = db.getLastAuditHash(branchId);
    const data = `${previousHash}${tick}${agentId}${field}${""}${suppressedValue}`;
    const entryHash = MerkleLogger.hash(data);

    db.insertAuditLog({
      tick,
      branchId,
      agentId,
      system: "Memory",
      field,
      oldValue: null,
      newValue: suppressedValue,
      causeEventId: null,
      causeDescription: null,
      suppressed: true,
      previousHash,
      entryHash,
    });
  }

  public static verifyChain(
    branchId: string,
    fromTick?: number,
    toTick?: number,
  ): { valid: boolean; error?: string } {
    const logs = db.getAuditLogs(branchId, fromTick, toTick);

    const firstLog = logs[0];
    let expectedPrevious =
      firstLog && firstLog.id === 1
        ? "0000000000000000000000000000000000000000000000000000000000000000"
        : null;

    if (!expectedPrevious && firstLog) {
      expectedPrevious = firstLog.previous_hash;
    }

    for (const entry of logs) {
      if (entry.previous_hash !== expectedPrevious) {
        return {
          valid: false,
          error: `Chain broken at log ID ${entry.id}: previous hash mismatch.`,
        };
      }

      const data = `${entry.previous_hash}${entry.tick}${entry.agent_id || ""}${entry.field}${entry.old_value || ""}${entry.new_value || ""}`;
      const computedHash = MerkleLogger.hash(data);

      if (entry.entry_hash !== computedHash) {
        return { valid: false, error: `Chain broken at log ID ${entry.id}: entry hash mismatch.` };
      }

      expectedPrevious = entry.entry_hash;
    }

    return { valid: true };
  }

  public static getAgentHistory(
    agentId: string,
    fromTick?: number,
    toTick?: number,
  ): AuditLogEntry[] {
    return db.getAgentHistory(agentId, fromTick, toTick);
  }
}
