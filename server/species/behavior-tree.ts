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
      const hunger = agent.body.hunger ?? 0;
      const health = agent.body.health ?? 1;
      const fatigue = agent.body.fatigue ?? 0;

      if (health < 0.2) {
        return { type: "FLEE", params: { direction: "away_from_threat" } };
      }

      if (fatigue > 0.85) {
        return { type: "REST", params: { duration: 30 } };
      }

      const adjacentFood = percept?.focusedVoxels?.find((v) => v.material === "food");
      if (adjacentFood && hunger > 0.3) {
        return { type: "EAT", params: { target: adjacentFood } };
      }

      if (hunger > 0.5) {
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
            return { type: "ATTACK", targetId: nearestPrey.id };
          }
          if (distance < 15) {
            return { type: "STALK", targetId: nearestPrey.id };
          }
          return {
            type: "MOVE",
            params: { goal: "hunt", toward: nearestPrey.position },
          };
        }

        return { type: "WANDER", params: { radius: 20, bias: "toward_open_terrain" } };
      }

      return { type: "WANDER", params: { radius: 10 } };
    }

    if (agent.speciesId === "deer") {
      if (agent.body.integrityDrive > 0.5) {
        return { type: "MOVE", params: { goal: "flee" } };
      }
    }
    return { type: "IDLE" };
  },
};
