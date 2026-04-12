import { db } from "../persistence/database";

export const FindingsJournal = {
  logFinding(branchId: string, tick: number, description: string, phenomenon: string): void {
    db.db
      .query(
        "INSERT INTO findings (id, branch_id, tick, description, phenomenon) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), branchId, tick, description, phenomenon);
  },
};
