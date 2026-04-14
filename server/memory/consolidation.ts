import {
  CONSOLIDATION_SALIENCE_THRESHOLD,
  DEATH_CONCEPT_OBSERVATIONS_REQUIRED,
} from "../../shared/constants";
import { EventType } from "../../shared/events";
import type { AgentState, ConsolidationResult } from "../../shared/types";
import type { EventBus } from "../core/event-bus";
import { EpisodicStore } from "./episodic-store";
import { SemanticStore } from "./semantic-store";

type OutcomeAggregate = {
  attempts: number;
  reliefHits: number;
  harmHits: number;
};

function getPrimaryPrimitiveType(ep: AgentState["episodicStore"][number]): string {
  const primitive = ep.motorPlan?.primitives?.[0];
  return primitive?.type ?? "unknown";
}

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

    // 1b. Procedural outcome consolidation (unnamed relief/aversion beliefs)
    const outcomeEpisodes = episodes.filter(
      (ep) => !ep.suppressed && ep.outcome && ep.motorPlan?.primitives?.length,
    );
    const aggregateByPattern = new Map<string, OutcomeAggregate>();
    for (const ep of outcomeEpisodes) {
      const primitiveType = getPrimaryPrimitiveType(ep);
      const cue = ep.contextTags[0] ?? "felt_state";
      const key = `${cue}::${primitiveType}`;
      const current = aggregateByPattern.get(key) ?? {
        attempts: 0,
        reliefHits: 0,
        harmHits: 0,
      };

      current.attempts += 1;
      if ((ep.outcome?.reliefScore ?? 0) > (ep.outcome?.harmScore ?? 0)) {
        current.reliefHits += 1;
      }
      if (
        (ep.outcome?.harmScore ?? 0) > (ep.outcome?.reliefScore ?? 0) ||
        (ep.outcome?.deltaToxinLoad ?? 0) > 0
      ) {
        current.harmHits += 1;
      }
      aggregateByPattern.set(key, current);
    }

    for (const aggregate of aggregateByPattern.values()) {
      if (aggregate.attempts < 2) continue;

      const reliefConfidence = aggregate.reliefHits / aggregate.attempts;
      const harmConfidence = aggregate.harmHits / aggregate.attempts;

      if (reliefConfidence >= 0.6) {
        SemanticStore.addProceduralPatternBelief(
          agent.id,
          branchId,
          "relief",
          reliefConfidence,
          aggregate.attempts,
        );
      }

      if (harmConfidence >= 0.6) {
        SemanticStore.addProceduralPatternBelief(
          agent.id,
          branchId,
          "aversion",
          harmConfidence,
          aggregate.attempts,
        );
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
