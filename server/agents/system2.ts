import { URGENCY_THRESHOLD } from "../../shared/constants";
import type {
  AgentState,
  FilteredPercept,
  SpeciesConfig,
  System2Output,
  WorldConfig,
} from "../../shared/types";
import type { LLMGateway } from "../llm/gateway";
import { MerkleLogger } from "../persistence/merkle-logger";

export class System2 {
  constructor(private gateway: LLMGateway) {}

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

    if (integrityDelta > 0.2) return true;
    if (newIntegrity > URGENCY_THRESHOLD) return true;

    if (Math.random() < 0.05) return true;

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
    let tomContext = "";
    if (filteredPercept.primaryAttention.length > 0) {
      tomContext = "\nOthers in your immediate attention:\n";
      for (const other of filteredPercept.primaryAttention) {
        const rel = agent.relationships.find((r) => r.targetAgentId === other.id);
        const relLabel = rel && rel.affinity > 0.5 ? "familiar" : "stranger";
        tomContext += `- ${other.name} (${relLabel}). They seem to be in a certain state.\n`;
      }
    }

    const systemPrompt = this.gateway.systemPromptForAgent(
      agent,
      {} as unknown as SpeciesConfig,
      config.semanticMasking,
    );
    const fullPrompt = `${qualiaText}${tomContext}\n\nWhat are your thoughts and what will you do? Response in JSON format: { "innerMonologue": "...", "decision": { "type": "...", "targetId": "..." }, "theoriesAboutOthers": [] }`;

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
