import type { SimEvent } from "../../shared/events";
import type {
  BodyStateDelta,
  EpisodicMemory,
  EpisodicMemoryRow,
  MemoryConfig,
  PrimitiveAction,
} from "../../shared/types";
import { db } from "../persistence/database";
import { MerkleLogger } from "../persistence/merkle-logger";

type MotorPlanSnapshot = NonNullable<EpisodicMemory["motorPlan"]>;
type OutcomeSnapshot = NonNullable<EpisodicMemory["outcome"]>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseJsonValue(input: string | null | undefined): unknown {
  if (!input) return undefined;
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return refs.length > 0 ? refs : undefined;
}

function decodeActionColumn(raw: string | null | undefined): {
  actionTaken?: PrimitiveAction;
  motorPlan?: MotorPlanSnapshot;
  perceptualRefs?: string[];
} {
  const parsed = parseJsonValue(raw);
  const obj = asRecord(parsed);
  if (!obj) return {};

  if ("type" in obj && typeof obj.type === "string") {
    return { actionTaken: obj as unknown as PrimitiveAction };
  }

  const decoded: {
    actionTaken?: PrimitiveAction;
    motorPlan?: MotorPlanSnapshot;
    perceptualRefs?: string[];
  } = {};
  if (asRecord(obj.actionTaken)) {
    decoded.actionTaken = obj.actionTaken as unknown as PrimitiveAction;
  }
  if (asRecord(obj.motorPlan)) {
    decoded.motorPlan = obj.motorPlan as MotorPlanSnapshot;
  }
  const refs = toStringArray(obj.perceptualRefs);
  if (refs) {
    decoded.perceptualRefs = refs;
  }
  return decoded;
}

function decodeOutcomeColumn(raw: string | null | undefined): {
  outcomeSummary?: string;
  outcome?: OutcomeSnapshot;
} {
  if (!raw) return {};
  const parsed = parseJsonValue(raw);
  const obj = asRecord(parsed);
  if (!obj) {
    return { outcomeSummary: raw };
  }

  const outcomeSummary =
    typeof obj.outcomeSummary === "string" && obj.outcomeSummary.length > 0
      ? obj.outcomeSummary
      : undefined;

  const decoded: {
    outcomeSummary?: string;
    outcome?: OutcomeSnapshot;
  } = {};
  if (outcomeSummary) {
    decoded.outcomeSummary = outcomeSummary;
  }
  if (asRecord(obj.outcome)) {
    decoded.outcome = obj.outcome as OutcomeSnapshot;
  }
  return decoded;
}

function encodeActionColumn(memory: EpisodicMemory): string | null {
  if (!memory.actionTaken && !memory.motorPlan && !memory.perceptualRefs) {
    return null;
  }

  if (!memory.motorPlan && !memory.perceptualRefs && memory.actionTaken) {
    return JSON.stringify(memory.actionTaken);
  }

  return JSON.stringify({
    actionTaken: memory.actionTaken,
    motorPlan: memory.motorPlan,
    perceptualRefs: memory.perceptualRefs,
  });
}

function encodeOutcomeColumn(memory: EpisodicMemory): string | null {
  if (!memory.outcomeSummary && !memory.outcome) {
    return null;
  }

  if (!memory.outcome && memory.outcomeSummary) {
    return memory.outcomeSummary;
  }

  return JSON.stringify({
    outcomeSummary: memory.outcomeSummary,
    outcome: memory.outcome,
  });
}

export const EpisodicStore = {
  encode(
    agentId: string,
    branchId: string,
    qualiaText: string,
    event: SimEvent,
    salience: number,
    _config: MemoryConfig,
  ): EpisodicMemory {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const rawMotorPlan = asRecord(payload.motorPlan);
    const rawOutcome = asRecord(payload.outcome);
    const perceptualRefs = toStringArray(payload.perceptualRefs);

    const memory: EpisodicMemory = {
      id: crypto.randomUUID(),
      tick: event.tick,
      qualiaText,
      salience,
      emotionalValence: (payload.valence as number) || 0,
      emotionalArousal: (payload.arousal as number) || 0,
      suppressed: false,
      contextTags: [],
      source: "real",
      actionTaken: asRecord(payload.actionTaken)
        ? (payload.actionTaken as unknown as PrimitiveAction)
        : undefined,
      motorPlan: rawMotorPlan ? (rawMotorPlan as MotorPlanSnapshot) : undefined,
      outcome: rawOutcome ? (rawOutcome as OutcomeSnapshot) : undefined,
      perceptualRefs,
      outcomeSummary:
        typeof payload.outcomeSummary === "string" ? (payload.outcomeSummary as string) : undefined,
      bodyShift: asRecord(payload.bodyShift)
        ? (payload.bodyShift as unknown as BodyStateDelta)
        : undefined,
    };

    const encodedAction = encodeActionColumn(memory);
    const encodedOutcome = encodeOutcomeColumn(memory);

    db.db
      .query(
        "INSERT INTO episodic_memories (id, agent_id, branch_id, tick, qualia_text, salience, emotional_valence, emotional_arousal, suppressed, source, context_tags, action_taken, outcome_summary, body_shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        encodedAction,
        encodedOutcome,
        memory.bodyShift ? JSON.stringify(memory.bodyShift) : null,
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

    const memories = rows.map((r: EpisodicMemoryRow) => {
      const action = decodeActionColumn(r.action_taken);
      const outcome = decodeOutcomeColumn(r.outcome_summary);
      return {
        id: r.id,
        tick: r.tick,
        qualiaText: r.qualia_text,
        salience: r.salience,
        emotionalValence: r.emotional_valence,
        emotionalArousal: r.emotional_arousal,
        suppressed: r.suppressed === 1,
        contextTags: JSON.parse(r.context_tags || "[]") as string[],
        source: r.source,
        actionTaken: action.actionTaken,
        motorPlan: action.motorPlan,
        perceptualRefs: action.perceptualRefs,
        outcomeSummary: outcome.outcomeSummary,
        outcome: outcome.outcome,
        bodyShift: r.body_shift ? JSON.parse(r.body_shift) : undefined,
      };
    });

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

    return rows.map((r) => {
      const action = decodeActionColumn(r.action_taken);
      const outcome = decodeOutcomeColumn(r.outcome_summary);
      return {
        id: r.id,
        tick: r.tick,
        qualiaText: r.qualia_text,
        salience: r.salience,
        emotionalValence: r.emotional_valence,
        emotionalArousal: r.emotional_arousal,
        suppressed: r.suppressed === 1,
        contextTags: JSON.parse(r.context_tags || "[]") as string[],
        source: r.source,
        actionTaken: action.actionTaken,
        motorPlan: action.motorPlan,
        perceptualRefs: action.perceptualRefs,
        outcomeSummary: outcome.outcomeSummary,
        outcome: outcome.outcome,
        bodyShift: r.body_shift ? JSON.parse(r.body_shift) : undefined,
      };
    });
  },
};
