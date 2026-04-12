import { RESIDUE_DECAY_MULTIPLIER, RESIDUE_EXPIRY_THRESHOLD } from "../../shared/constants";
import type { AgentState, MemoryConfig } from "../../shared/types";

export const DecayEngine = {
  tickAll(
    agents: AgentState[],
    _branchId: string,
    config: MemoryConfig,
    _currentTick: number,
  ): void {
    // 1. Episodic decay — handled at retrieval time (append-only compatible)
    // ACT-R power-law decay is applied during EpisodicStore.retrieve()
    // by computing elapsed ticks and adjusting salience scores.

    for (const agent of agents) {
      // 2. Feeling residue decay
      if (agent.feelingResidues) {
        for (let i = agent.feelingResidues.length - 1; i >= 0; i--) {
          const r = agent.feelingResidues[i];
          if (r) {
            r.valence *= 1 - config.episodicDecayRate * RESIDUE_DECAY_MULTIPLIER;
            r.arousal *= 1 - config.episodicDecayRate * RESIDUE_DECAY_MULTIPLIER;
            if (
              Math.abs(r.valence) < RESIDUE_EXPIRY_THRESHOLD &&
              Math.abs(r.arousal) < RESIDUE_EXPIRY_THRESHOLD
            ) {
              agent.feelingResidues.splice(i, 1);
            }
          }
        }
      }
    }
  },
};
