import type { SimEvent } from "../../shared/events";
import type { EpisodicMemory, EpisodicMemoryRow, MemoryConfig } from "../../shared/types";
import { db } from "../persistence/database";
import { MerkleLogger } from "../persistence/merkle-logger";

export const EpisodicStore = {
  encode(
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
  },

  /**
   * Encode a dream-sourced memory with explicit source and emotional data.
   * Avoids the need for `as unknown as SimEvent` casts.
   */
  encodeDream(
    agentId: string,
    branchId: string,
    qualiaText: string,
    tick: number,
    salience: number,
    source: EpisodicMemory["source"],
    valence = 0,
    arousal = 0,
  ): EpisodicMemory {
    const memory: EpisodicMemory = {
      id: crypto.randomUUID(),
      tick,
      qualiaText,
      salience,
      emotionalValence: valence,
      emotionalArousal: arousal,
      suppressed: false,
      contextTags: [],
      source,
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
        0,
        memory.source,
        JSON.stringify(memory.contextTags),
      );

    return memory;
  },

  retrieve(agentId: string, branchId: string, k: number): EpisodicMemory[] {
    // Retrieve base memories
    const rows = db.db
      .query(
        "SELECT * FROM episodic_memories WHERE agent_id = ? AND branch_id = ? ORDER BY tick DESC LIMIT ?",
      )
      .all(agentId, branchId, k) as EpisodicMemoryRow[];

    const memories = rows.map((r) => ({
      id: r.id,
      tick: r.tick,
      qualiaText: r.qualia_text,
      salience: r.salience,
      emotionalValence: r.emotional_valence,
      emotionalArousal: r.emotional_arousal,
      suppressed: r.suppressed === 1,
      contextTags: JSON.parse(r.context_tags || "[]") as string[],
      source: r.source,
    }));

    // Apply suppression events (append-only pattern)
    const memoryIds = memories.map((m) => m.id);
    if (memoryIds.length > 0) {
      const suppressions = db.db
        .query(
          `SELECT target_memory_id FROM episodic_suppression_events
           WHERE target_memory_id IN (${memoryIds.map(() => "?").join(",")})`,
        )
        .all(...memoryIds) as { target_memory_id: string }[];

      const suppressedIds = new Set(suppressions.map((s) => s.target_memory_id));
      for (const m of memories) {
        if (suppressedIds.has(m.id)) {
          m.suppressed = true;
        }
      }

      // Apply context tag events (append-only pattern)
      const tagEvents = db.db
        .query(
          `SELECT target_memory_id, tag FROM episodic_context_tag_events
           WHERE target_memory_id IN (${memoryIds.map(() => "?").join(",")})`,
        )
        .all(...memoryIds) as { target_memory_id: string; tag: string }[];

      for (const te of tagEvents) {
        const memory = memories.find((m) => m.id === te.target_memory_id);
        if (memory && !memory.contextTags.includes(te.tag)) {
          memory.contextTags.push(te.tag);
        }
      }
    }

    return memories;
  },

  /**
   * Append-only suppression: inserts a suppression event row instead of UPDATE.
   * The suppression is resolved at retrieval time.
   */
  suppress(agentId: string, branchId: string, memoryId: string, tick: number): void {
    db.db
      .query(
        "INSERT INTO episodic_suppression_events (id, target_memory_id, agent_id, branch_id, tick) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), memoryId, agentId, branchId, tick);

    MerkleLogger.logSuppression(
      agentId,
      branchId,
      "episodic_memory",
      `Suppressed memory ${memoryId}`,
      tick,
    );
  },

  /**
   * Append-only context tagging: inserts a tag event row instead of UPDATE.
   * Tags are resolved at retrieval time.
   */
  contextTag(agentId: string, branchId: string, memoryId: string, tag: string): void {
    db.db
      .query(
        "INSERT INTO episodic_context_tag_events (id, target_memory_id, agent_id, branch_id, tag) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), memoryId, agentId, branchId, tag);
  },

  getHighSalience(agentId: string, branchId: string, minSalience: number): EpisodicMemory[] {
    const rows = db.db
      .query(
        "SELECT * FROM episodic_memories WHERE agent_id = ? AND branch_id = ? AND salience >= ? ORDER BY salience DESC",
      )
      .all(agentId, branchId, minSalience) as EpisodicMemoryRow[];

    return rows.map((r) => ({
      id: r.id,
      tick: r.tick,
      qualiaText: r.qualia_text,
      salience: r.salience,
      emotionalValence: r.emotional_valence,
      emotionalArousal: r.emotional_arousal,
      suppressed: r.suppressed === 1,
      contextTags: JSON.parse(r.context_tags || "[]") as string[],
      source: r.source,
    }));
  },
};
