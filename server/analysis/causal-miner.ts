import { EventType, type SimEvent } from "../../shared/events";
import type { EmbodiedDiscoveryMetrics } from "../../shared/types";
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
  [EventType.ACTION_ATTEMPTED, [EventType.ACTION_SUCCEEDED, EventType.ACTION_FAILED]],
  [EventType.MOUTH_CONTACTED, [EventType.INGESTION_OCCURRED]],
  [
    EventType.INGESTION_OCCURRED,
    [EventType.ENERGY_IMPROVED, EventType.HYDRATION_IMPROVED, EventType.TOXIN_EXPOSURE],
  ],
  [EventType.ENERGY_IMPROVED, [EventType.AFFORDANCE_CONFIDENCE_CHANGED]],
  [EventType.HYDRATION_IMPROVED, [EventType.AFFORDANCE_CONFIDENCE_CHANGED]],
  [EventType.PAIN_AVOIDANCE_LEARNED, [EventType.PROCEDURAL_PATTERN_FORMED]],
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

  extractEmbodiedDiscoveryMetrics(branchIdOrEvents: string | SimEvent[]): EmbodiedDiscoveryMetrics {
    const events = extractEvents(branchIdOrEvents);

    const firstHydration = events.find((event) => event.type === EventType.HYDRATION_IMPROVED);
    const firstEnergy = events.find((event) => event.type === EventType.ENERGY_IMPROVED);
    const firstToxinExposure = events.find((event) => event.type === EventType.TOXIN_EXPOSURE);

    let proceduralActions = 0;
    let system2Actions = 0;
    let reliefWindowActions = 0;
    let reliefWindowTotal = 0;
    let postToxinIngestions = 0;
    let totalPostToxinActions = 0;

    for (const event of events) {
      if (event.type === EventType.ACTION_ATTEMPTED) {
        const source = (event.payload?.source as string | undefined) ?? "";
        if (source === "procedural") {
          proceduralActions += 1;
        } else if (source === "system2") {
          system2Actions += 1;
        }
      }

      if (
        firstHydration &&
        event.type === EventType.ACTION_SUCCEEDED &&
        event.tick >= firstHydration.tick
      ) {
        reliefWindowTotal += 1;
        if (event.tick - firstHydration.tick <= 25) {
          reliefWindowActions += 1;
        }
      }

      if (firstToxinExposure && event.tick >= firstToxinExposure.tick) {
        if (event.type === EventType.ACTION_ATTEMPTED) {
          totalPostToxinActions += 1;
        }
        if (event.type === EventType.INGESTION_OCCURRED) {
          const toxic = Number(event.payload?.toxicity ?? 0) > 0;
          if (toxic) {
            postToxinIngestions += 1;
          }
        }
      }
    }

    const totalActions = Math.max(1, proceduralActions + system2Actions);
    const survivalTicks = events.length === 0 ? 0 : Math.max(...events.map((event) => event.tick));

    return {
      survivalTicks,
      ...(firstHydration ? { firstHydrationImprovementTick: firstHydration.tick } : {}),
      ...(firstEnergy ? { firstEnergyImprovementTick: firstEnergy.tick } : {}),
      repeatedReliefActionRate:
        reliefWindowTotal === 0
          ? 0
          : Math.max(0, Math.min(1, reliefWindowActions / reliefWindowTotal)),
      toxinAvoidanceAfterExposure:
        totalPostToxinActions === 0
          ? 1
          : Math.max(0, Math.min(1, 1 - postToxinIngestions / totalPostToxinActions)),
      proceduralActionRatio: proceduralActions / totalActions,
      system2ActionRatio: system2Actions / totalActions,
      veilBreachCount: events.filter((event) => event.type === EventType.VEIL_BREACH).length,
    };
  },
};
