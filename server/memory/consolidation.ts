import { DEATH_CONCEPT_OBSERVATIONS_REQUIRED } from "../../shared/constants";
import { EventType } from "../../shared/events";
import type { AgentState, ConsolidationResult } from "../../shared/types";
import type { EventBus } from "../core/event-bus";
import { EpisodicStore } from "./episodic-store";
import { SemanticStore } from "./semantic-store";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class Consolidation {
  public static consolidate(
    agent: AgentState,
    branchId: string,
    eventBus: EventBus,
  ): ConsolidationResult {
    // 1. Standard CLS transfer (simplified: high salience episodic -> semantic)
    const episodes = EpisodicStore.retrieve(agent.id, branchId, 10);
    const highSalience = episodes.filter((e) => e.salience > 0.8 && !e.suppressed);

    let transferredCount = 0;
    for (const ep of highSalience) {
      SemanticStore.addBelief(agent.id, branchId, {
        id: crypto.randomUUID(),
        concept: "past_event",
        value: ep.qualiaText,
        confidence: ep.salience,
        sourceCount: 1,
      });
      transferredCount++;
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
  }
}
