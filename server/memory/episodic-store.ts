import type { SimEvent } from "../../shared/events";
import type { EpisodicMemory, MemoryConfig } from "../../shared/types";
import { db } from "../persistence/database";
import { MerkleLogger } from "../persistence/merkle-logger";

interface EpisodicMemoryRow {
  id: string;
  tick: number;
  qualia_text: string;
  salience: number;
  emotional_valence: number;
  emotional_arousal: number;
  suppressed: number;
  source: "real" | "dream_prophetic" | "nightmare" | "dream_healing" | "dream_chaos";
  context_tags: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class EpisodicStore {
  public static encode(
    agentId: string,
    branchId: string,
    qualiaText: string,
    event: SimEvent,
    salience: number,
    _config: MemoryConfig,
  ): EpisodicMemory {
    const memory: EpisodicMemory = {
      id: crypto.randomUUID(),
      tick: event.tick,
      qualiaText,
      salience,
      emotionalValence: (event.payload.valence as number) || 0,
      emotionalArousal: (event.payload.arousal as number) || 0,
      suppressed: false,
      contextTags: [],
      source: "real",
    };

    db.db
      .query(
        "INSERT INTO episodic_memories (id, agent_id, branch_id, tick, qualia_text, salience, emotional_valence, emotional_arousal, suppressed, source, context_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        memory.id,
        agentId,
        branchId,
        memory.tick,
        memory.qualiaText,
        memory.salience,
        memory.emotionalValence,
        memory.emotionalArousal,
        memory.suppressed ? 1 : 0,
        memory.source,
        JSON.stringify(memory.contextTags),
      );

    return memory;
  }

  public static retrieve(agentId: string, branchId: string, k: number): EpisodicMemory[] {
    const rows = db.db
      .query(
        "SELECT * FROM episodic_memories WHERE agent_id = ? AND branch_id = ? ORDER BY tick DESC LIMIT ?",
      )
      .all(agentId, branchId, k) as EpisodicMemoryRow[];

    return rows.map((r) => ({
      id: r.id,
      tick: r.tick,
      qualiaText: r.qualia_text,
      salience: r.salience,
      emotionalValence: r.emotional_valence,
      emotionalArousal: r.emotional_arousal,
      suppressed: r.suppressed === 1,
      contextTags: JSON.parse(r.context_tags || "[]"),
      source: r.source,
    }));
  }

  public static suppress(agentId: string, branchId: string, memoryId: string, tick: number): void {
    db.db.query("UPDATE episodic_memories SET suppressed = 1 WHERE id = ?").run(memoryId);

    MerkleLogger.logSuppression(
      agentId,
      branchId,
      "episodic_memory",
      `Suppressed memory ${memoryId}`,
      tick,
    );
  }

  public static contextTag(memoryId: string, tag: string): void {
    const row = db.db
      .query("SELECT context_tags FROM episodic_memories WHERE id = ?")
      .get(memoryId) as { context_tags: string } | null;
    if (row) {
      const tags = JSON.parse(row.context_tags || "[]") as string[];
      if (!tags.includes(tag)) {
        tags.push(tag);
        db.db
          .query("UPDATE episodic_memories SET context_tags = ? WHERE id = ?")
          .run(JSON.stringify(tags), memoryId);
      }
    }
  }
}
