import type { ActionDecision, AgentState, FilteredPercept } from "../../shared/types";

function distanceBetween(a: AgentState["position"], b: AgentState["position"]): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export const BehaviorTree = {
  tick(agent: AgentState, percept?: FilteredPercept): ActionDecision {
    if (agent.speciesId === "wolf") {
      const energy = agent.body.energy ?? 1;
      const health = agent.body.health ?? 1;
      const fatigue = agent.body.fatigue ?? 0;

      if (health < 0.2) {
        return { type: "TURN", deltaYaw: 3.14 }; // Turn away
      }

      if (fatigue > 0.85) {
        return { type: "REST" };
      }

      const adjacentFood = percept?.focusedVoxels?.find((v) => v.material === "food");
      if (adjacentFood && energy < 0.7) {
        return { type: "INGEST_ATTEMPT", targetId: "adjacent_food" };
      }

      if (energy < 0.5) {
        const nearestPrey = (percept?.primaryAttention ?? [])
          .filter((other) => other.speciesId !== "wolf")
          .sort(
            (left, right) =>
              distanceBetween(agent.position, left.position) -
              distanceBetween(agent.position, right.position),
          )[0];

        if (nearestPrey) {
          const distance = distanceBetween(agent.position, nearestPrey.position);
          if (distance < 3) {
            return { type: "INGEST_ATTEMPT", targetId: nearestPrey.id };
          }
          return { type: "MOVE", forward: 1.0 };
        }

        return { type: "MOVE", forward: 0.5 };
      }

      return { type: "TURN", deltaYaw: 0.5 };
    }

    if (agent.speciesId === "deer") {
      if (agent.body.integrityDrive > 0.5) {
        return { type: "MOVE", forward: 1.0 };
      }
    }
    return { type: "DEFER" };
  },
};
