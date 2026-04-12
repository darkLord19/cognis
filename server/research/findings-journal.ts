import type { Finding } from "../../shared/types";
import { db } from "../persistence/database";

type FindingRow = {
  id: string;
  branch_id: string;
  tick: number;
  description: string;
  phenomenon: string;
  interpretation: Finding["interpretation"] | null;
  evidence_ids: string | null;
};

function parseEvidenceIds(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export const FindingsJournal = {
  logFinding(
    branchId: string,
    tick: number,
    description: string,
    phenomenon: string,
    interpretation: Finding["interpretation"] | null = null,
    evidenceIds: string[] = [],
  ): void {
    db.db
      .query(
        "INSERT INTO findings (id, branch_id, tick, description, phenomenon, interpretation, evidence_ids) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        crypto.randomUUID(),
        branchId,
        tick,
        description,
        phenomenon,
        interpretation,
        JSON.stringify(evidenceIds),
      );
  },

  getFindings(branchId: string): Finding[] {
    const rows = db.db
      .query<FindingRow, [string]>(
        "SELECT id, branch_id, tick, description, phenomenon, interpretation, evidence_ids FROM findings WHERE branch_id = ? ORDER BY tick ASC, id ASC",
      )
      .all(branchId) as FindingRow[];

    return rows.map((row) => ({
      id: row.id,
      tick: row.tick,
      description: row.description,
      phenomenon: row.phenomenon,
      ...(row.interpretation ? { interpretation: row.interpretation } : {}),
      evidenceIds: parseEvidenceIds(row.evidence_ids),
    }));
  },
};
