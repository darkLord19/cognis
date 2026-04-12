import { db } from "../persistence/database";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class FindingsJournal {
  public static logFinding(
    branchId: string,
    tick: number,
    description: string,
    phenomenon: string,
  ): void {
    db.db
      .query(
        "INSERT INTO findings (id, branch_id, tick, description, phenomenon) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), branchId, tick, description, phenomenon);
  }
}
