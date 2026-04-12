import type { SimEvent } from "../../shared/events";
import type { AgentState, DreamConfig, MemoryConfig } from "../../shared/types";
import { EpisodicStore } from "../memory/episodic-store";
import { MerkleLogger } from "../persistence/merkle-logger";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class DreamEngine {
  public static async dream(
    agent: AgentState,
    branchId: string,
    dreamConfig: DreamConfig,
    _memConfig: MemoryConfig,
    tick: number,
  ): Promise<void> {
    if (!dreamConfig.consolidationEnabled) return;

    const rand = Math.random();
    if (rand < dreamConfig.consolidationProbability) {
      DreamEngine.dreamConsolidation(agent, branchId, tick);
    } else if (rand < dreamConfig.consolidationProbability + dreamConfig.traumaProbability) {
      DreamEngine.dreamHealing(agent, branchId, tick);
    } else if (
      rand <
      dreamConfig.consolidationProbability +
        dreamConfig.traumaProbability +
        dreamConfig.chaosProbability
    ) {
      DreamEngine.dreamChaos(agent, branchId, tick);
    } else {
      DreamEngine.dreamProphetic(agent, branchId, tick);
    }
  }

  private static dreamConsolidation(agent: AgentState, branchId: string, tick: number): void {
    const episodes = EpisodicStore.retrieve(agent.id, branchId, 5);
    for (const ep of episodes) {
      EpisodicStore.encode(
        agent.id,
        branchId,
        `Dream replay: ${ep.qualiaText}`,
        { tick, payload: {} } as unknown as SimEvent,
        ep.salience * 0.5,
        {} as unknown as MemoryConfig,
      );
    }
    MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "consolidation", null);
  }

  private static dreamHealing(agent: AgentState, branchId: string, tick: number): void {
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
      }
    }
  }

  private static dreamChaos(agent: AgentState, branchId: string, tick: number): void {
    const episodes = EpisodicStore.retrieve(agent.id, branchId, 10);
    if (episodes.length >= 2) {
      const m1 = episodes[Math.floor(Math.random() * episodes.length)];
      const m2 = episodes[Math.floor(Math.random() * episodes.length)];
      if (m1 && m2) {
        const combined = `A strange vision of ${m1.qualiaText.substring(0, 20)} and ${m2.qualiaText.substring(0, 20)}`;
        EpisodicStore.encode(
          agent.id,
          branchId,
          combined,
          { tick, payload: { source: "dream_chaos" } } as unknown as SimEvent,
          0.5,
          {} as unknown as MemoryConfig,
        );
      }
    }
    MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "chaos", null);
  }

  private static dreamProphetic(agent: AgentState, branchId: string, tick: number): void {
    MerkleLogger.log(tick, branchId, agent.id, "Dream", "mode", null, "prophetic", null);
  }
}
