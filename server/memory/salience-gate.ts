import type { SimEvent } from "../../shared/events";
import type { AgentState, MemoryConfig } from "../../shared/types";

export const SalienceGate = {
  computeSalience(event: SimEvent, agent: AgentState, _config: MemoryConfig): number {
    const payload = event.payload || {};
    const valenceMag = Math.abs((payload.valence as number) || 0);
    const arousalMag = Math.abs((payload.arousal as number) || 0);

    let painFactor = 0;
    if (agent.body?.bodyMap) {
      const bm = agent.body.bodyMap;
      const maxPain = Math.max(
        bm.head.pain,
        bm.torso.pain,
        bm.leftArm.pain,
        bm.rightArm.pain,
        bm.leftLeg.pain,
        bm.rightLeg.pain,
      );
      painFactor = maxPain;
    }

    const isNovel = payload.isNovel ? 1.0 : 0.2;

    const salience = valenceMag * 0.3 + arousalMag * 0.3 + painFactor * 0.3 + isNovel * 0.1;
    return Math.min(1.0, salience);
  },
};
