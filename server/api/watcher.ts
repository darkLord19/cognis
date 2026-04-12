import { EventType } from "../../shared/events";
import type { EventBus } from "../core/event-bus";
import { RunContext } from "../core/run-context";

export interface WatcherOptions {
  verbosity: "quiet" | "normal" | "verbose";
  showTicks: boolean;
  showLanguage: boolean;
  showDeaths: boolean;
  showEmergence: boolean;
  showCircadian: boolean;
  tickInterval: number;
}

const defaultOptions: WatcherOptions = {
  verbosity: "verbose",
  showTicks: true,
  showLanguage: true,
  showDeaths: true,
  showEmergence: true,
  showCircadian: true,
  tickInterval: 50,
};

export class Watcher {
  private eventBus: EventBus;
  private options: WatcherOptions;

  constructor(eventBus: EventBus, options: Partial<WatcherOptions> = {}) {
    this.eventBus = eventBus;
    this.options = { ...defaultOptions, ...options };
    this.attach();
  }

  private attach(): void {
    this.eventBus.onAny((event) => this.handleEvent(event));
  }

  private handleEvent(event: import("../../shared/events").SimEvent): void {
    const tick = event.tick;
    const ctx = RunContext.get();
    const agentCount = ctx?.agents.length ?? 0;

    // Log all events in verbose mode except tick
    if (this.options.verbosity === "verbose") {
      if (event.type !== "tick") {
        console.log(`[WATCHER] ${event.type} @ tick ${tick}`);
      }
    }

    // Always show tick summaries
    if (tick % this.options.tickInterval === 0) {
      this.printTickSummary(tick, agentCount);
    }

    switch (event.type) {
      case EventType.WORD_ENTERED_LEXICON:
        if (this.options.showLanguage) {
          const word = event.payload.token as string;
          const referent = event.payload.referent as string;
          const consensusCount = event.payload.consensus_count as number;
          console.log(
            `[tick ${tick.toString().padStart(4, "0")}] LANGUAGE: "${word}" entered lexicon (${referent}, ${consensusCount} agents)`,
          );
        }
        break;

      case EventType.PROTO_WORD_COINED:
        if (this.options.showLanguage) {
          const word = event.payload.token as string;
          const referent = event.payload.referent as string;
          console.log(
            `[tick ${tick.toString().padStart(4, "0")}] LANGUAGE: coined "${word}" (${referent})`,
          );
        }
        break;

      case EventType.AGENT_DIED:
        if (this.options.showDeaths) {
          const agentId = event.payload.agent_id as string;
          const cause = event.payload.cause as string;
          const witnesses = event.payload.witness_count as number;
          console.log(
            `[tick ${tick.toString().padStart(4, "0")}] DEATH: Agent ${agentId} died. cause: ${cause}. ${witnesses} witnessed.`,
          );
        }
        break;

      case EventType.EMERGENCE_DETECTED:
        if (this.options.showEmergence) {
          const behavior = event.payload.behavior as string;
          const description = event.payload.description as string;
          console.log(
            `[tick ${tick.toString().padStart(4, "0")}] EMERGENCE: ${behavior} — ${description}`,
          );
        }
        break;

      case EventType.CIRCADIAN_PHASE_CHANGED:
        if (this.options.showCircadian) {
          const phase = event.payload.phase as string;
          console.log(`[tick ${tick.toString().padStart(4, "0")}] CIRCADIAN: ${phase}`);
        }
        break;

      case EventType.DREAM_OCCURRED:
        if (this.options.verbosity === "verbose") {
          const agentId = event.payload.agent_id as string;
          const dreamType = event.payload.dream_type as string;
          console.log(
            `[tick ${tick.toString().padStart(4, "0")}] DREAM: Agent ${agentId} — ${dreamType}`,
          );
        }
        break;
    }
  }

  private printTickSummary(tick: number, agentCount: number): void {
    console.log(
      `[WATCHER tick ${tick.toString().padStart(4, "0")}] ${agentCount} agents, interval: ${this.options.tickInterval}`,
    );
  }

  public stop(): void {
    console.log("\n--- Watcher stopped ---");
  }
}
