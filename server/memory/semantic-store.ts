import type { SemanticBelief } from "../../shared/types";
import { db } from "../persistence/database";

interface SemanticBeliefRow {
  id: string;
  agent_id: string;
  branch_id: string;
  concept: string;
  value: string;
  confidence: number;
  source_count: number;
}

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class SemanticStore {
  public static addBelief(agentId: string, branchId: string, belief: SemanticBelief): void {
    // Append-only: just insert a new record. We'll query the latest or aggregate.
    // To avoid PK conflict, we use a new UUID for the row if needed,
    // but the table schema has 'id TEXT PRIMARY KEY'.
    // Since we cannot UPDATE, we must ensure every insertion has a unique ID.
    db.db
      .query(`
      INSERT INTO semantic_beliefs (id, agent_id, branch_id, concept, value, confidence, source_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        crypto.randomUUID(),
        agentId,
        branchId,
        belief.concept,
        String(belief.value),
        belief.confidence,
        belief.sourceCount,
      );
  }

  public static getBeliefs(agentId: string, branchId: string): SemanticBelief[] {
    const rows = db.db
      .query("SELECT * FROM semantic_beliefs WHERE agent_id = ? AND branch_id = ?")
      .all(agentId, branchId) as SemanticBeliefRow[];
    return rows.map((r) => ({
      id: r.id,
      concept: r.concept,
      value: r.value,
      confidence: r.confidence,
      sourceCount: r.source_count,
    }));
  }

  public static trackDeathObservation(
    agentId: string,
    branchId: string,
    observationType: string,
  ): void {
    SemanticStore.addBelief(agentId, branchId, {
      id: crypto.randomUUID(),
      concept: observationType,
      value: "1",
      confidence: 1.0,
      sourceCount: 1,
    });
  }

  public static getDeathObservationCount(
    agentId: string,
    branchId: string,
    concept: string,
  ): number {
    const row = db.db
      .query<{ count: number }, [string, string, string]>(
        "SELECT SUM(source_count) as count FROM semantic_beliefs WHERE agent_id = ? AND branch_id = ? AND concept = ?",
      )
      .get(agentId, branchId, concept);
    return row?.count || 0;
  }
}
