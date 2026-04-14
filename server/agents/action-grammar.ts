import type { PrimitiveAction } from "../../shared/types";

export const PRIMITIVE_ACTIONS: PrimitiveAction["type"][] = [
  "TURN",
  "MOVE",
  "STOP",
  "REACH",
  "GRASP",
  "DROP",
  "MOUTH_CONTACT",
  "INGEST_ATTEMPT",
  "VOCALIZE",
  "REST",
  "DEFER",
];

export function isPrimitiveAction(actionType: string): actionType is PrimitiveAction["type"] {
  return PRIMITIVE_ACTIONS.includes(actionType as PrimitiveAction["type"]);
}

export enum ActuationType {
  LOCOMOTE_TOWARD = "locomote_toward",
  LOCOMOTE_AWAY = "locomote_away",
  LOCOMOTE_IDLE = "locomote_idle",

  CROUCH = "crouch",
  LIE_DOWN = "lie_down",
  STAND_UP = "stand_up",

  REACH_TOWARD = "reach_toward",
  GRASP = "grasp",
  RELEASE = "release",
  PUSH = "push",
  PULL = "pull",
  STRIKE = "strike",
  CARRY = "carry",
  PLACE = "place",

  OPEN_MOUTH = "open_mouth",
  BITE = "bite",
  CHEW = "chew",
  SWALLOW = "swallow",
  SPIT = "spit",
  LICK = "lick",

  VOCALIZE = "vocalize",

  GAZE_AT = "gaze_at",
  GAZE_SCAN = "gaze_scan",
  SNIFF = "sniff",
  LISTEN = "listen",

  REST_POSTURE = "rest_posture",
}

export type PerceptualTarget =
  | { type: "self" }
  | { type: "perceptual_ref"; ref: string }
  | { type: "direction"; direction: "front" | "left" | "right" | "behind" }
  | { type: "none" };

export type MotorPrimitive = {
  type: ActuationType;
  target: PerceptualTarget;
  intensity: number; // 0..1
  durationTicks: number;
};

export type MotorPlan = {
  source: "system0" | "procedural" | "system2" | "fallback";
  primitives: MotorPrimitive[];
  urgency: number;
  createdAtTick: number;
  reason?: string; // operator only, never Qualia
};

export function translateLegacyActionToMotorPlan(
  action: string,
  tick: number,
  hasMouthItem: boolean,
): MotorPlan | null {
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
    case "EAT":
      if (!hasMouthItem) return null;
      return {
        source: "fallback",
        urgency: 0.7,
        createdAtTick: tick,
        primitives: [
          {
            type: ActuationType.SWALLOW,
            target: { type: "perceptual_ref", ref: "mouth_item" },
            intensity: 1,
            durationTicks: 1,
          },
        ],
      };
    default:
      return null;
  }
}
