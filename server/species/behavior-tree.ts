import type { ActionDecision, AgentState } from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class BehaviorTree {
  public static tick(agent: AgentState): ActionDecision {
    if (agent.speciesId === "wolf") {
      if (agent.body.hunger > 0.5) {
        return { type: "MOVE", params: { goal: "hunt" } };
      }
    }
    if (agent.speciesId === "deer") {
      if (agent.body.integrityDrive > 0.5) {
        return { type: "MOVE", params: { goal: "flee" } };
      }
    }
    return { type: "IDLE" };
  }
}
