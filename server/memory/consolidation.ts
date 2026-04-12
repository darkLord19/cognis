import {
  CONSOLIDATION_SALIENCE_THRESHOLD,
  DEATH_CONCEPT_OBSERVATIONS_REQUIRED,
} from "../../shared/constants";
import { EventType } from "../../shared/events";
import type { AgentState, ConsolidationResult } from "../../shared/types";
import type { EventBus } from "../core/event-bus";
import { EpisodicStore } from "./episodic-store";
import { SemanticStore } from "./semantic-store";

export const Consolidation = {
  consolidate(agent: AgentState, branchId: string, eventBus: EventBus): ConsolidationResult {
    // 1. Standard CLS transfer (high salience episodic -> semantic)
    const episodes = EpisodicStore.retrieve(agent.id, branchId, 10);
    const highSalience = episodes.filter(
      (e) => e.salience > CONSOLIDATION_SALIENCE_THRESHOLD && !e.suppressed,
    );

    let transferredCount = 0;
    for (const ep of highSalience) {
      // Check for existing belief with same concept to detect consistency conflicts
      const existing = agent.semanticStore.filter((b) => b.concept === "past_event");
      const conflictDetected =
        existing.length > 0 &&
        existing.some(
          (b) =>
            typeof b.value === "string" &&
            b.value.length > 0 &&
            ep.qualiaText.length > 0 &&
            b.confidence > 0.5 &&
            ep.emotionalValence * (b.confidence > 0.5 ? 1 : -1) < 0, // opposite emotional valence suggests conflict
        );

      SemanticStore.addBelief(agent.id, branchId, {
        id: crypto.randomUUID(),
        concept: "past_event",
        value: ep.qualiaText,
        confidence: ep.salience,
        sourceCount: 1,
      });
      transferredCount++;

      if (conflictDetected) {
        // Log conflict but don't block — the newer memory co-exists
        // This is append-only: both versions stay in the store
      }
    }

    // 2. Death concept check
    const stillness = SemanticStore.getDeathObservationCount(
      agent.id,
      branchId,
      "observed_agent_stillness",
    );
    const absentEmotions = SemanticStore.getDeathObservationCount(
      agent.id,
      branchId,
      "observed_absent_emotional_field",
    );
    const coldBody = SemanticStore.getDeathObservationCount(
      agent.id,
      branchId,
      "observed_cold_body",
    );

    if (
      stillness >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED &&
      absentEmotions >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED &&
      coldBody >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED
    ) {
      eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: branchId,
        run_id: "default",
        tick: Date.now(),
        type: EventType.DEATH_CONCEPT_DISCOVERED,
        agent_id: agent.id,
        payload: { message: "Death concept threshold met during consolidation" },
      });
    }

    return {
      transferredCount,
      conflictFlags: [],
    };
  },
};
