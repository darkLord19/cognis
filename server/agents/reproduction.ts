import type { AgentState, MuscleStats, SpeciesConfig } from "../../shared/types";
import { MerkleLogger } from "../persistence/merkle-logger";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class Reproduction {
  public static crossover(
    parentA: AgentState,
    parentB: AgentState,
    species: SpeciesConfig,
  ): MuscleStats {
    const mutate = (val: number, range: [number, number]) => {
      const mutation = (Math.random() - 0.5) * 0.1;
      return Math.max(range[0], Math.min(range[1], val + mutation));
    };

    return {
      strength: mutate(
        (parentA.muscleStats.strength + parentB.muscleStats.strength) / 2,
        species.muscleStatRanges.strength,
      ),
      speed: mutate(
        (parentA.muscleStats.speed + parentB.muscleStats.speed) / 2,
        species.muscleStatRanges.speed,
      ),
      endurance: mutate(
        (parentA.muscleStats.endurance + parentB.muscleStats.endurance) / 2,
        species.muscleStatRanges.endurance,
      ),
    };
  }

  public static handleDeath(agent: AgentState, branchId: string, tick: number): void {
    // Log semantic store to MerkleLogger (Sole Witness logic)
    for (const belief of agent.semanticStore) {
      MerkleLogger.log(
        tick,
        branchId,
        agent.id,
        "DeathAudit",
        belief.concept,
        null,
        String(belief.value),
        null,
      );
    }
  }
}
