import type { SimEvent } from "../../shared/events";
import type { AgentState, MemoryConfig } from "../../shared/types";

export const SalienceGate = {
  computeSalience(event: SimEvent, agent: AgentState, _config: MemoryConfig): number {
    const payload = event.payload || {};
    const outcome = (payload.outcome ?? {}) as {
      deltaPain?: number;
      deltaToxinLoad?: number;
      reliefScore?: number;
    };

    let painDelta = Math.max(0, Math.abs(outcome.deltaPain ?? 0));
    if (painDelta === 0 && agent.body?.bodyMap) {
      const bm = agent.body.bodyMap;
      painDelta = Math.max(
        bm.head.pain,
        bm.torso.pain,
        bm.leftArm.pain,
        bm.rightArm.pain,
        bm.leftLeg.pain,
        bm.rightLeg.pain,
      );
    }

    const reliefScore = Math.max(0, outcome.reliefScore ?? 0);
    const toxinDelta = Math.max(0, Math.abs(outcome.deltaToxinLoad ?? 0));
    const novelty = payload.isNovel ? 1.0 : 0.2;
    const socialIntensity = Math.max(0, Math.min(1, (payload.socialIntensity as number) ?? 0));

    const salience =
      painDelta * 0.25 +
      reliefScore * 0.25 +
      toxinDelta * 0.25 +
      novelty * 0.15 +
      socialIntensity * 0.1;
    return Math.max(0, Math.min(1, salience));
  },
};
