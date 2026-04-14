import type { SemanticBelief, SemanticBeliefRow } from "../../shared/types";
import { db } from "../persistence/database";

export const SemanticStore = {
  addBelief(agentId: string, branchId: string, belief: SemanticBelief): void {
    // Append-only: just insert a new record. We query the latest or aggregate at read time.
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
  },

  getBeliefs(agentId: string, branchId: string): SemanticBelief[] {
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
  },

  trackDeathObservation(agentId: string, branchId: string, observationType: string): void {
    SemanticStore.addBelief(agentId, branchId, {
      id: crypto.randomUUID(),
      concept: observationType,
      value: "1",
      confidence: 1.0,
      sourceCount: 1,
    });
  },

  getDeathObservationCount(agentId: string, branchId: string, concept: string): number {
    const row = db.db
      .query<{ count: number }, [string, string, string]>(
        "SELECT SUM(source_count) as count FROM semantic_beliefs WHERE agent_id = ? AND branch_id = ? AND concept = ?",
      )
      .get(agentId, branchId, concept);
    return row?.count || 0;
  },

  addProceduralPatternBelief(
    agentId: string,
    branchId: string,
    kind: "relief" | "aversion",
    confidence: number,
    sourceCount: number,
  ): void {
    const concept = kind === "relief" ? "procedural_relief_pattern" : "procedural_aversion_pattern";
    const value =
      kind === "relief"
        ? "when this feeling and nearby presence recur, this action often eases the feeling"
        : "when this feeling and nearby presence recur, this action often worsens the feeling";

    SemanticStore.addBelief(agentId, branchId, {
      id: crypto.randomUUID(),
      concept,
      value,
      confidence: Math.max(0, Math.min(1, confidence)),
      sourceCount: Math.max(1, sourceCount),
    });
  },
};
