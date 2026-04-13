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
import { resolveAgentReference } from "./qualia-processor";

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
    const oldIntegrity =
      typeof bodyDelta.previousIntegrityDrive === "number"
        ? bodyDelta.previousIntegrityDrive
        : (agent.body.integrityDrive ?? 0);
    const newIntegrity =
      typeof bodyDelta.currentIntegrityDrive === "number"
        ? bodyDelta.currentIntegrityDrive
        : typeof bodyDelta.integrityDrive === "number"
          ? bodyDelta.integrityDrive
          : (agent.body.integrityDrive ?? 0);
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
    options?: { urgencyOverride?: boolean },
  ): Promise<System2Output> {
    // Build Theory of Mind context from nearby agents
    let tomContext = "";
    if (filteredPercept.primaryAttention.length > 0) {
      tomContext = "\nOthers in your immediate attention:\n";
      for (const other of filteredPercept.primaryAttention) {
        const rel = agent.relationships.find((r) => r.targetAgentId === other.id);
        const reference = resolveAgentReference(other.id, agent);

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

        tomContext += `- ${reference}.${emotionNote}${behaviourNote}\n`;
      }
    }

    // Urgency override text
    let urgencyPrefix = "";
    if (options?.urgencyOverride || agent.body.integrityDrive > URGENCY_THRESHOLD) {
      urgencyPrefix =
        "URGENT: Integrity pressure is critical. Prioritize immediate survival regulation.\n\n";
    }

    // Look up actual species config
    const species = (this.speciesRegistry?.get(agent.speciesId) ?? {
      id: agent.speciesId || "unknown",
      name: "being",
      cognitiveTier: "full_llm" as const,
      emotionalFieldEnabled: true,
      socialCapacity: "full" as const,
      canLearnLanguage: true,
      canBedomesticated: false,
      threatLevel: 0,
      ecologicalRole: "neutral" as const,
      survivalDriveWeight: 1.0,
      circadianSensitivity: 1.0,
      sleepConfig: {
        mode: "natural_sleep",
        fatigueEnabled: true,
        fatigueRate: 0.01,
        recoveryRate: 0.05,
        minRestDuration: 10,
        maxWakeDuration: 100,
        cognitivePenaltyNoSleep: 0.1,
        emotionalPenaltyNoSleep: 0.1,
        healthPenaltyNoSleep: 0.1,
        consolidationDuringSleep: true,
        consolidationWhileAwake: false,
        consolidationIntervalTicks: 10,
        dreamsEnabled: true,
        nightmaresEnabled: true,
        sleepSchedule: "synchronized",
      },
      memoryConfig: {},
      dnaTraits: [],
      baseStats: {
        maxHealth: 100,
        speed: 1,
        strength: 1,
        metabolism: 1,
        lifespanTicks: 1000,
        reproductionAge: 100,
        gestationTicks: 50,
      },
      senseProfile: { sight: 30, hearing: 50, smell: 15, touch: 5, taste: 3 },
      muscleStatRanges: {
        strength: [0, 1] as [number, number],
        speed: [0, 1] as [number, number],
        endurance: [0, 1] as [number, number],
      },
      behaviorTree: [],
    }) as SpeciesConfig;

    const systemPrompt = this.gateway.systemPromptForAgent(agent, species, config.semanticMasking);
    const fullPrompt = `${urgencyPrefix}${qualiaText}${tomContext}\n\nRespond in JSON format: { "innerMonologue": "...", "decision": { "type": "...", "targetId": "..." }, "theoriesAboutOthers": [] }. Use sensory vectors and actuator language; do not output speech acts.`;

    const rawResponse = await this.gateway.complete(agent.id, fullPrompt, systemPrompt);

    try {
      const start = rawResponse.indexOf("{");
      const end = rawResponse.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
      const jsonStr = rawResponse.substring(start, end + 1);
      const output = JSON.parse(jsonStr) as System2Output;
      const decisionType = (output.decision as { type?: string } | undefined)?.type;
      if (decisionType === "COMMUNICATE") {
        output.decision = { type: "IDLE" };
      }
      if ("utterance" in output) {
        delete output.utterance;
      }

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
