import type { QualiaFrame } from "../../shared/types";

/**
 * QualiaValidator ensures that the epistemological wall is not breached.
 * It scans the output for any data leaks from the operator layer.
 */
const FORBIDDEN_PATTERNS = [
  /simulation/i,
  /code/i,
  /data/i,
  /tick/i,
  /op-id/i,
  /agent_id/i,
  /operator_id/i,
  /coordinate/i,
  /voxel_type/i,
  /material_type/i,
  /tech_node/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUIDs
  /\d+\.\d+/, // Decimal numbers
];

/**
 * Validates a complete QualiaFrame.
 * Returns false if ANY forbidden pattern is found.
 */
export function validateQualia(frame: QualiaFrame): boolean {
  const allText = [
    ...frame.foreground,
    ...frame.body,
    ...frame.peripheral,
    ...frame.social,
    ...frame.urges,
    ...frame.atmosphere,
  ].join(" ");

  const failedPattern = FORBIDDEN_PATTERNS.find((pattern) => pattern.test(allText));
  if (failedPattern) {
    console.error(`QualiaValidator: Forbidden pattern detected: ${failedPattern}`);
    return false;
  }

  return true;
}

/**
 * Cleans text to remove common forbidden patterns.
 * This is a fallback; the templates themselves should be clean.
 */
export function sanitizeQualia(text: string): string {
  const sanitized = text;
  // ... logic for cleaning common leaks if necessary
  return sanitized;
}
