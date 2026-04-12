import type { AgentState, DreamConfig, MemoryConfig } from "../../shared/types";
import { EpisodicStore } from "../memory/episodic-store";
import { MerkleLogger } from "../persistence/merkle-logger";

function dreamConsolidation(agent: AgentState, branchId: string, tick: number): void {
  const episodes = EpisodicStore.retrieve(agent.id, branchId, 5);
  for (const ep of episodes) {
    // Use encodeDream to avoid unsafe SimEvent cast
    EpisodicStore.encodeDream(
      agent.id,
      branchId,
      `Dream replay: ${ep.qualiaText}`,
      tick,
      ep.salience * 0.5,
      "dream_healing",
      ep.emotionalValence,
      ep.emotionalArousal,
    );
  }
  MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "consolidation", null);
}

function dreamHealing(agent: AgentState, branchId: string, tick: number): void {
  if (agent.traumaFlags && agent.traumaFlags.length > 0) {
    const trauma = agent.traumaFlags[0];
    if (trauma) {
      const oldSeverity = trauma.severity;
      trauma.severity *= 0.8;
      MerkleLogger.log(
        tick,
        branchId,
        agent.id,
        "Dream",
        "trauma_reduction",
        trauma.id,
        String(oldSeverity),
        null,
      );

      // Create a healing dream memory
      EpisodicStore.encodeDream(
        agent.id,
        branchId,
        "A gentler version of a painful memory replays, its edges softened.",
        tick,
        0.6,
        "dream_healing",
        0.2, // slightly positive valence from healing
        0.3,
      );
    }
  }
}

function dreamChaos(agent: AgentState, branchId: string, tick: number): void {
  const episodes = EpisodicStore.retrieve(agent.id, branchId, 10);
  if (episodes.length >= 2) {
    const m1 = episodes[Math.floor(Math.random() * episodes.length)];
    const m2 = episodes[Math.floor(Math.random() * episodes.length)];
    if (m1 && m2) {
      const combined = `A strange vision of ${m1.qualiaText.substring(0, 20)} and ${m2.qualiaText.substring(0, 20)}`;
      // Use encodeDream to avoid unsafe casts
      EpisodicStore.encodeDream(agent.id, branchId, combined, tick, 0.5, "dream_chaos");
    }
  }
  MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "chaos", null);
}

function dreamProphetic(agent: AgentState, branchId: string, tick: number): void {
  // Create a prophetic dream memory with novel recombination
  EpisodicStore.encodeDream(
    agent.id,
    branchId,
    "A vivid flash of something not-yet, a pattern forming just beyond comprehension.",
    tick,
    0.7,
    "dream_prophetic",
    0.1,
    0.5,
  );
  MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "prophetic", null);
}

export const DreamEngine = {
  async dream(
    agent: AgentState,
    branchId: string,
    dreamConfig: DreamConfig,
    _memConfig: MemoryConfig,
    tick: number,
  ): Promise<void> {
    if (!dreamConfig.consolidationEnabled) return;

    const rand = Math.random();
    if (rand < dreamConfig.consolidationProbability) {
      dreamConsolidation(agent, branchId, tick);
    } else if (rand < dreamConfig.consolidationProbability + dreamConfig.traumaProbability) {
      dreamHealing(agent, branchId, tick);
    } else if (
      rand <
      dreamConfig.consolidationProbability +
        dreamConfig.traumaProbability +
        dreamConfig.chaosProbability
    ) {
      dreamChaos(agent, branchId, tick);
    } else {
      dreamProphetic(agent, branchId, tick);
    }
  },
};
