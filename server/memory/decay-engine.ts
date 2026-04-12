import type { AgentState, MemoryConfig } from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class DecayEngine {
  public static tickAll(
    agents: AgentState[],
    _branchId: string,
    config: MemoryConfig,
    _currentTick: number,
  ): void {
    // 1. Episodic decay (ACT-R power law simplified)
    // Since we are append-only, decay is tricky.
    // We could either:
    // a) Update rows (FORBIDDEN)
    // b) Calculate decay during retrieval (BEST)
    // c) Insert decay "events" (OVERKILL for now)

    // For now, we'll assume retrieval handles time-based decay.
    // But the task says "Expired feeling residues cleaned up".
    // Residues are in-memory on AgentState? Let's check types.
    // Yes, AgentState.feelingResidues is an array.

    for (const agent of agents) {
      // 2. Feeling residue decay
      if (agent.feelingResidues) {
        for (let i = agent.feelingResidues.length - 1; i >= 0; i--) {
          const r = agent.feelingResidues[i];
          if (r) {
            r.valence *= 1 - config.episodicDecayRate * 0.1;
            r.arousal *= 1 - config.episodicDecayRate * 0.1;
            if (Math.abs(r.valence) < 0.05 && Math.abs(r.arousal) < 0.05) {
              agent.feelingResidues.splice(i, 1);
            }
          }
        }
      }
    }
  }
}
