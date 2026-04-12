import type { AuditLogEntry } from "../../shared/types";
import { db } from "./database";

function hash(data: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data);
  return hasher.digest("hex");
}

function serializeEntryForHash(entry: {
  previousHash: string;
  tick: number;
  branchId: string;
  agentId: string | null;
  system: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  causeEventId: string | null;
  causeDescription: string | null;
  suppressed: boolean;
}): string {
  return JSON.stringify({
    previousHash: entry.previousHash,
    tick: entry.tick,
    branchId: entry.branchId,
    agentId: entry.agentId,
    system: entry.system,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    causeEventId: entry.causeEventId,
    causeDescription: entry.causeDescription,
    suppressed: entry.suppressed,
  });
}

export const MerkleLogger = {
  log(
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
    const data = serializeEntryForHash({
      previousHash,
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
    });
    const entryHash = hash(data);

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
  },

  logSuppression(
    agentId: string,
    branchId: string,
    field: string,
    suppressedValue: string,
    tick: number,
  ): void {
    const previousHash = db.getLastAuditHash(branchId);
    const data = serializeEntryForHash({
      previousHash,
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
    });
    const entryHash = hash(data);

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
  },

  verifyChain(
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

      const data = serializeEntryForHash({
        previousHash: entry.previous_hash,
        tick: entry.tick,
        branchId: entry.branch_id,
        agentId: entry.agent_id,
        system: entry.system,
        field: entry.field,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        causeEventId: entry.cause_event_id,
        causeDescription: entry.cause_description,
        suppressed: Boolean(entry.suppressed),
      });
      const computedHash = hash(data);

      if (entry.entry_hash !== computedHash) {
        return { valid: false, error: `Chain broken at log ID ${entry.id}: entry hash mismatch.` };
      }

      expectedPrevious = entry.entry_hash;
    }

    return { valid: true };
  },

  getAgentHistory(agentId: string, fromTick?: number, toTick?: number): AuditLogEntry[] {
    return db.getAgentHistory(agentId, fromTick, toTick);
  },
};
