import {
  DEFAULT_LEXICON_CONFIDENCE,
  DEFAULT_MIN_AGENTS_FOR_CONSENSUS,
  PROTO_WORD_COOCCURRENCE_THRESHOLD,
} from "../../shared/constants";
import { EventType } from "../../shared/events";
import type { AgentState, LexiconEntry, VocalActuation, Voxel } from "../../shared/types";
import type { EventBus } from "../core/event-bus";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class LanguageEmergence {
  /** Per-agent co-occurrence counts: key = "agentId:token", value = Map<referent, count> */
  private static coOccurrences: Map<string, Map<string, number>> = new Map();

  /**
   * Tracks which agents have individually coined a proto-word for a given token:referent pair.
   * Key = "token:referent", value = Set<agentId>
   * Stage 3 consensus requires DEFAULT_MIN_AGENTS_FOR_CONSENSUS agents.
   */
  private static protoWordAgents: Map<string, Set<string>> = new Map();

  /** Tracks token:referent pairs that have already achieved consensus */
  private static consensusAchieved: Set<string> = new Set();

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
    if (count === PROTO_WORD_COOCCURRENCE_THRESHOLD) {
      // Stage 2: Individual agent has coined a proto-word
      eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: branchId,
        run_id: "default",
        tick: Date.now(),
        type: EventType.PROTO_WORD_COINED,
        agent_id: agentId,
        payload: { token, referent, count },
      });

      // Track this agent towards Stage 3 consensus
      const consensusKey = `${token}:${referent}`;
      let agentSet = LanguageEmergence.protoWordAgents.get(consensusKey);
      if (!agentSet) {
        agentSet = new Set();
        LanguageEmergence.protoWordAgents.set(consensusKey, agentSet);
      }
      agentSet.add(agentId);

      // Stage 3: Check if consensus threshold (3+ agents) is met
      if (
        agentSet.size >= DEFAULT_MIN_AGENTS_FOR_CONSENSUS &&
        !LanguageEmergence.consensusAchieved.has(consensusKey)
      ) {
        LanguageEmergence.consensusAchieved.add(consensusKey);

        eventBus.emit({
          event_id: crypto.randomUUID(),
          branch_id: branchId,
          run_id: "default",
          tick: Date.now(),
          type: EventType.WORD_ENTERED_LEXICON,
          payload: {
            token,
            referent,
            consensusCount: agentSet.size,
            message: `Proto-word "${token}" achieved consensus for "${referent}" across ${agentSet.size} agents`,
          },
        });
      }
    }
  }

  /**
   * Stage 3: Promote a token to an agent's lexicon.
   * Requires consensus — at least DEFAULT_MIN_AGENTS_FOR_CONSENSUS agents
   * must have independently coined the proto-word.
   * Returns true if promotion succeeded, false if consensus not yet met.
   */
  public static promoteToLexicon(
    agent: AgentState,
    token: string,
    referent: string,
    branchId: string,
    eventBus: EventBus,
  ): boolean {
    // Check consensus requirement
    const consensusKey = `${token}:${referent}`;
    const agentSet = LanguageEmergence.protoWordAgents.get(consensusKey);
    if (!agentSet || agentSet.size < DEFAULT_MIN_AGENTS_FOR_CONSENSUS) {
      return false; // Consensus not yet reached
    }

    const entry: LexiconEntry = {
      word: token,
      concept: referent,
      confidence: DEFAULT_LEXICON_CONFIDENCE,
      consensusCount: agentSet.size,
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
        payload: { token, referent, consensusCount: agentSet.size },
      });
      return true;
    }

    return false;
  }

  /**
   * Check if a token:referent pair has reached consensus.
   * Used by orchestrator to auto-promote to listening agents.
   */
  public static hasConsensus(token: string, referent: string): boolean {
    return LanguageEmergence.consensusAchieved.has(`${token}:${referent}`);
  }

  /**
   * Get all proto-words that have reached consensus.
   */
  public static getConsensusWords(): Array<{ token: string; referent: string; agentCount: number }> {
    const result: Array<{ token: string; referent: string; agentCount: number }> = [];
    for (const key of LanguageEmergence.consensusAchieved) {
      const [token, referent] = key.split(":");
      const agentSet = LanguageEmergence.protoWordAgents.get(key);
      if (token && referent) {
        result.push({ token, referent, agentCount: agentSet?.size ?? 0 });
      }
    }
    return result;
  }

  /** Reset state — used in testing */
  public static reset(): void {
    LanguageEmergence.coOccurrences.clear();
    LanguageEmergence.protoWordAgents.clear();
    LanguageEmergence.consensusAchieved.clear();
  }
}
