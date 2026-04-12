import { EventType } from "../../shared/events";
import type { AgentState, LexiconEntry, VocalActuation, Voxel } from "../../shared/types";
import type { EventBus } from "../core/event-bus";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class LanguageEmergence {
  private static coOccurrences: Map<string, Map<string, number>> = new Map();

  public static processVocalActuation(
    actuation: VocalActuation,
    listeners: AgentState[],
    nearbyVoxels: Voxel[],
    branchId: string,
    eventBus: EventBus,
  ): void {
    for (const listener of listeners) {
      const referents = nearbyVoxels
        .filter((v) => v.material !== "air" && v.material !== "water")
        .map((v) => v.material);

      for (const referent of referents) {
        LanguageEmergence.recordCoOccurrence(
          listener.id,
          actuation.soundToken,
          referent,
          branchId,
          eventBus,
        );
      }
    }
  }

  private static recordCoOccurrence(
    agentId: string,
    token: string,
    referent: string,
    branchId: string,
    eventBus: EventBus,
  ): void {
    const key = `${agentId}:${token}`;
    let map = LanguageEmergence.coOccurrences.get(key);
    if (!map) {
      map = new Map();
      LanguageEmergence.coOccurrences.set(key, map);
    }
    map.set(referent, (map.get(referent) || 0) + 1);

    const count = map.get(referent) || 0;
    if (count === 5) {
      eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: branchId,
        run_id: "default",
        tick: Date.now(),
        type: EventType.PROTO_WORD_COINED,
        agent_id: agentId,
        payload: { token, referent, count },
      });
    }
  }

  public static promoteToLexicon(
    agent: AgentState,
    token: string,
    referent: string,
    branchId: string,
    eventBus: EventBus,
  ): void {
    const entry: LexiconEntry = {
      word: token,
      concept: referent,
      confidence: 0.8,
      consensusCount: 1,
    };

    if (!agent.lexicon.some((l) => l.word === token)) {
      agent.lexicon.push(entry);
      eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: branchId,
        run_id: "default",
        tick: Date.now(),
        type: EventType.WORD_ENTERED_LEXICON,
        agent_id: agent.id,
        payload: { token, referent },
      });
    }
  }
}
