import { LEGACY_SYMBOLIC_SURVIVAL_ACTIONS } from "../../shared/constants";
import { ActuationType, type MotorPlan } from "./action-grammar";

export const legacyAdapter = {
  translate(action: string, tick: number, _hasMouthItem = false): MotorPlan | null {
    if (
      LEGACY_SYMBOLIC_SURVIVAL_ACTIONS.includes(
        action as (typeof LEGACY_SYMBOLIC_SURVIVAL_ACTIONS)[number],
      )
    ) {
      return null;
    }

    switch (action) {
      case "MOVE":
        return {
          source: "fallback",
          urgency: 0.4,
          createdAtTick: tick,
          primitives: [
            {
              type: ActuationType.LOCOMOTE_TOWARD,
              target: { type: "direction", direction: "front" },
              intensity: 0.6,
              durationTicks: 1,
            },
          ],
        };
      case "WANDER":
        return {
          source: "fallback",
          urgency: 0.3,
          createdAtTick: tick,
          primitives: [
            {
              type: ActuationType.GAZE_SCAN,
              target: { type: "none" },
              intensity: 0.4,
              durationTicks: 1,
            },
            {
              type: ActuationType.LOCOMOTE_TOWARD,
              target: { type: "direction", direction: "front" },
              intensity: 0.3,
              durationTicks: 1,
            },
          ],
        };
      case "REST":
        return {
          source: "fallback",
          urgency: 0.2,
          createdAtTick: tick,
          primitives: [
            {
              type: ActuationType.REST_POSTURE,
              target: { type: "self" },
              intensity: 0.5,
              durationTicks: 1,
            },
          ],
        };
      default:
        return null;
    }
  },
};
