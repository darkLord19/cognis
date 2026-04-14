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
