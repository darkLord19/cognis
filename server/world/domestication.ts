import type { AgentState, SpeciesConfig } from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class DomesticationManager {
  public static update(_agent: AgentState, species: SpeciesConfig): void {
    if (!species.canBedomesticated) return;
    // Emergent bonding logic
  }
}
