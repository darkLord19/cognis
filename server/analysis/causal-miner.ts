import { EventType, type SimEvent } from "../../shared/events";
import { loadBranchEvents } from "./event-queries";

export type CausalCandidate = {
  causeEventId: string;
  effectEventId: string;
  causeType: EventType;
  effectType: EventType;
  tick: number;
  deltaTicks: number;
  confidence: number;
  description: string;
};

const successorMap: Map<EventType, EventType[]> = new Map([
  [EventType.PROTO_WORD_COINED, [EventType.WORD_ENTERED_LEXICON, EventType.GRAMMAR_RULE_FORMED]],
  [EventType.WORD_ENTERED_LEXICON, [EventType.GRAMMAR_RULE_FORMED, EventType.TECH_DISCOVERED]],
  [EventType.DEATH_CONCEPT_DISCOVERED, [EventType.TECH_DISCOVERED]],
  [EventType.BRANCH_CREATED, [EventType.BASELINE_DIVERGENCE_FOUND]],
  [EventType.INTERVENTION_APPLIED, [EventType.INTERVENTION_RESISTED]],
]);

function extractEvents(branchIdOrEvents: string | SimEvent[]): SimEvent[] {
  return Array.isArray(branchIdOrEvents) ? branchIdOrEvents : loadBranchEvents(branchIdOrEvents);
}

function isLikelyCause(cause: SimEvent, effect: SimEvent): boolean {
  if (cause.tick >= effect.tick) return false;

  const successors = successorMap.get(cause.type);
  if (successors?.includes(effect.type)) {
    return true;
  }

  if (cause.type === effect.type) {
    return false;
  }

  const causeImportance = cause.importance ?? 0;
  const effectImportance = effect.importance ?? 0;
  return effectImportance >= causeImportance && effect.tick - cause.tick <= 5;
}

function buildDescription(cause: SimEvent, effect: SimEvent): string {
  return `${cause.type} at tick ${cause.tick} plausibly led to ${effect.type} at tick ${effect.tick}`;
}

export const CausalMiner = {
  mine(branchIdOrEvents: string | SimEvent[], maxWindowTicks = 5): CausalCandidate[] {
    const events = extractEvents(branchIdOrEvents);
    const candidates: CausalCandidate[] = [];

    for (let effectIndex = 1; effectIndex < events.length; effectIndex += 1) {
      const effect = events[effectIndex];
      if (!effect) {
        continue;
      }

      let bestCause: SimEvent | undefined;

      for (let causeIndex = effectIndex - 1; causeIndex >= 0; causeIndex -= 1) {
        const cause = events[causeIndex];
        if (!cause) {
          continue;
        }

        const deltaTicks = effect.tick - cause.tick;
        if (deltaTicks > maxWindowTicks) break;
        if (!isLikelyCause(cause, effect)) continue;
        bestCause = cause;
        break;
      }

      if (!bestCause) continue;

      const deltaTicks = effect.tick - bestCause.tick;
      const confidence = Math.min(
        0.95,
        0.55 + Math.max(0, (maxWindowTicks - deltaTicks) / Math.max(maxWindowTicks, 1)) * 0.25,
      );

      candidates.push({
        causeEventId: bestCause.event_id,
        effectEventId: effect.event_id,
        causeType: bestCause.type,
        effectType: effect.type,
        tick: effect.tick,
        deltaTicks,
        confidence,
        description: buildDescription(bestCause, effect),
      });
    }

    return candidates;
  },
};
