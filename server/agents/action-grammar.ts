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
