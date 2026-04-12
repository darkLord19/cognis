import type { Finding } from "../../shared/types";
import { db } from "../persistence/database";

export const FindingsJournal = {
  logFinding(branchId: string, tick: number, description: string, phenomenon: string): void {
    db.db
      .query(
        "INSERT INTO findings (id, branch_id, tick, description, phenomenon) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), branchId, tick, description, phenomenon);
  },

  getFindings(branchId: string): Finding[] {
    return db.db
      .query<Finding, [string]>("SELECT * FROM findings WHERE branch_id = ? ORDER BY tick ASC")
      .all(branchId) as Finding[];
  },
};
