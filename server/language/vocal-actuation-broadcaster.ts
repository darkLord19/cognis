import { EventType } from "../../shared/events";
import type { VocalActuation } from "../../shared/types";
import type { EventBus } from "../core/event-bus";

export const VocalActuationBroadcaster = {
  broadcast(
    actuation: VocalActuation,
    branchId: string,
    runId: string,
    eventBus: EventBus,
  ): void {
    eventBus.emit({
      event_id: crypto.randomUUID(),
      branch_id: branchId,
      run_id: runId,
      tick: actuation.tick,
      type: EventType.VOCAL_ACTUATION,
      agent_id: actuation.emitterId,
      payload: {
        soundToken: actuation.soundToken,
        arousal: actuation.arousal,
        valence: actuation.valence,
      },
    });
  },
};
