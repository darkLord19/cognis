import { EventType, type SimEvent } from "../../shared/events";

type EmergenceFinding = {
  name: string;
  description: string;
  confidence: number;
};

type SoftPattern = {
  name: string;
  description: string;
  check: (events: SimEvent[]) => boolean;
};

export class EmergenceDetector {
  private knownBehaviours: Set<string> = new Set([
    "basic_tool_use",
    "fire_making",
    "shelter_building",
    "food_sharing",
    "pain_avoidance",
    "predator_flight",
    "social_grooming",
  ]);
  private emittedFindings: Set<string> = new Set();

  private normalize(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  public registerKnownBehaviour(behaviourName: string): void {
    this.knownBehaviours.add(this.normalize(behaviourName));
  }

  public detectNovelty(behaviourName: string): boolean {
    return !this.knownBehaviours.has(this.normalize(behaviourName));
  }

  public analyzeEventBatch(events: SimEvent[]): EmergenceFinding[] {
    if (events.length > 0) {
      console.log(`[EmergenceDetector] Received ${events.length} events for analysis`);
      console.log(`[EmergenceDetector] Pre-registered classes: ${this.knownBehaviours.size}`);
    }

    const softPatterns: SoftPattern[] = [
      {
        name: "social_clustering",
        description: "Agents consistently move toward each other rather than away",
        check: (batch) => {
          const moveTowardEvents = batch.filter(
            (event) =>
              event.type === EventType.DECISION_MADE &&
              (event.payload?.decision as { type?: string })?.type === "MOVE" &&
              ((event.payload?.decision as { params?: Record<string, unknown> })?.params?.goal ===
                "toward_agent" ||
                (event.payload?.decision as { params?: Record<string, unknown> })?.params?.goal ===
                  "hunt"),
          );
          return moveTowardEvents.length > 5;
        },
      },
      {
        name: "repeated_proximity",
        description: "Two specific agents appear near each other across many ticks",
        check: (batch) => {
          const proximityPairs = new Map<string, number>();
          for (const event of batch) {
            if (event.type !== EventType.DECISION_MADE) continue;
            const targetId = (event.payload?.decision as { params?: Record<string, unknown> })
              ?.params?.targetId;
            if (typeof targetId !== "string" || typeof event.agent_id !== "string") continue;
            const pair = [event.agent_id, targetId].sort().join("-");
            proximityPairs.set(pair, (proximityPairs.get(pair) ?? 0) + 1);
          }
          return Array.from(proximityPairs.values()).some((count) => count > 10);
        },
      },
      {
        name: "behavioral_rhythm",
        description: "Sustained non-random decision activity emerges over time",
        check: (batch) => batch.filter((event) => event.type === EventType.DECISION_MADE).length > 50,
      },
    ];

    const findings: EmergenceFinding[] = [];
    for (const pattern of softPatterns) {
      if (pattern.check(events) && !this.emittedFindings.has(pattern.name)) {
        this.emittedFindings.add(pattern.name);
        findings.push({
          name: pattern.name,
          description: pattern.description,
          confidence: 0.5,
        });
      }
    }
    return findings;
  }
}
