import {
  INTEGRITY_DELTA_THRESHOLD,
  SYSTEM2_RANDOM_FIRE_CHANCE,
  URGENCY_THRESHOLD,
} from "../../shared/constants";
import type {
  AgentState,
  FilteredPercept,
  SpeciesConfig,
  System2Output,
  WorldConfig,
} from "../../shared/types";
import type { LLMGateway } from "../llm/gateway";
import { MerkleLogger } from "../persistence/merkle-logger";
import type { SpeciesRegistry } from "../species/registry";

export class System2 {
  constructor(
    private gateway: LLMGateway,
    private speciesRegistry?: SpeciesRegistry,
  ) {}

  public shouldFire(
    agent: AgentState,
    bodyDelta: Record<string, unknown>,
    _percept: FilteredPercept,
    _config: WorldConfig,
  ): boolean {
    const oldIntegrity = agent.body.integrityDrive || 0;
    const newIntegrity =
      (agent.body.integrityDrive || 0) + ((bodyDelta.integrityDrive as number) || 0);
    const integrityDelta = Math.abs(newIntegrity - oldIntegrity);

    if (integrityDelta > INTEGRITY_DELTA_THRESHOLD) return true;
    if (newIntegrity > URGENCY_THRESHOLD) return true;

    if (Math.random() < SYSTEM2_RANDOM_FIRE_CHANCE) return true;

    return false;
  }

  public async think(
    agent: AgentState,
    qualiaText: string,
    filteredPercept: FilteredPercept,
    config: WorldConfig,
    tick: number,
    branchId: string,
  ): Promise<System2Output> {
    // Build Theory of Mind context from nearby agents
    let tomContext = "";
    if (filteredPercept.primaryAttention.length > 0) {
      tomContext = "\nOthers in your immediate attention:\n";
      for (const other of filteredPercept.primaryAttention) {
        const rel = agent.relationships.find((r) => r.targetAgentId === other.id);
        const relLabel = rel && rel.affinity > 0.5 ? "familiar" : "stranger";

        // Include behavioural patterns from relationship history
        let behaviourNote = "";
        if (rel && rel.significantEvents.length > 0) {
          const lastEvent = rel.significantEvents[rel.significantEvents.length - 1];
          if (lastEvent) {
            behaviourNote = ` You recall a past encounter with them.`;
          }
        }

        // Include emotional field impressions
        const emotionNote =
          other.body.arousal > 0.6
            ? " They seem agitated."
            : other.body.valence > 0.5
              ? " They seem content."
              : other.body.valence < -0.5
                ? " They seem distressed."
                : " Their state is unclear.";

        tomContext += `- ${other.name} (${relLabel}).${emotionNote}${behaviourNote}\n`;
      }
    }

    // Urgency override text
    let urgencyPrefix = "";
    if (agent.body.integrityDrive > URGENCY_THRESHOLD) {
      urgencyPrefix =
        "URGENT: Your survival is at stake. You must act immediately to address your most pressing need.\n\n";
    }

    // Look up actual species config
    const species: SpeciesConfig = this.speciesRegistry?.get(agent.speciesId) ?? {
      id: agent.speciesId || "unknown",
      name: "being",
      baseLifespan: 1000,
      metabolismRate: 1.0,
      senseProfile: { sight: 30, hearing: 50, smell: 15, touch: 5, taste: 3 },
      muscleStatRanges: {
        strength: [0, 1],
        speed: [0, 1],
        endurance: [0, 1],
      },
      reproductionConfig: {
        enabled: false,
        minAge: 100,
        gestationTicks: 50,
        maxOffspring: 1,
        geneticDrift: 0.1,
      },
      behaviorTree: [],
    };

    const systemPrompt = this.gateway.systemPromptForAgent(
      agent,
      species,
      config.semanticMasking,
    );
    const fullPrompt = `${urgencyPrefix}${qualiaText}${tomContext}\n\nWhat are your thoughts and what will you do? Response in JSON format: { "innerMonologue": "...", "decision": { "type": "...", "targetId": "..." }, "theoriesAboutOthers": [] }`;

    const rawResponse = await this.gateway.complete(agent.id, fullPrompt, systemPrompt);

    try {
      const output = JSON.parse(rawResponse) as System2Output;

      MerkleLogger.log(
        tick,
        branchId,
        agent.id,
        "System2",
        "innerMonologue",
        null,
        output.innerMonologue,
        null,
      );

      return output;
    } catch (e) {
      console.error("Failed to parse System2 output:", e);
      return {
        innerMonologue: "I am confused.",
        decision: { type: "IDLE" },
      };
    }
  }
}
