import { ActuationType, type PerceptualTarget } from "./action-grammar";

type ParseErrorCode =
  | "empty"
  | "invalid_json"
  | "missing_thought"
  | "missing_motor_plan"
  | "invalid_primitive";

export type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      code: ParseErrorCode;
      error: string;
    };

export type System2JsonOutput = {
  thought: string;
  motorPlan: {
    primitives: Array<{
      type: ActuationType;
      target: PerceptualTarget;
      intensity: number;
      durationTicks: number;
    }>;
  };
  vocalization?: string;
  memoryNote?: string;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty response");
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseTarget(input: unknown): PerceptualTarget | null {
  if (!input || typeof input !== "object") return null;
  const source = input as {
    type?: string;
    ref?: string;
    direction?: string;
  };

  if (source.type === "self") return { type: "self" };
  if (source.type === "none") return { type: "none" };
  if (
    source.type === "direction" &&
    (source.direction === "front" ||
      source.direction === "left" ||
      source.direction === "right" ||
      source.direction === "behind")
  ) {
    return { type: "direction", direction: source.direction };
  }
  if (source.type === "perceptual_ref" && typeof source.ref === "string" && source.ref.length > 0) {
    return { type: "perceptual_ref", ref: source.ref };
  }
  return null;
}

export function parseSystem2Output(raw: string): ParseResult<System2JsonOutput> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (error) {
    return {
      ok: false,
      code: raw.trim().length === 0 ? "empty" : "invalid_json",
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, code: "invalid_json", error: "Root payload must be an object" };
  }

  const payload = parsed as {
    thought?: unknown;
    motorPlan?: { primitives?: unknown } | undefined;
    vocalization?: unknown;
    memoryNote?: unknown;
  };

  if (typeof payload.thought !== "string" || payload.thought.trim().length === 0) {
    return { ok: false, code: "missing_thought", error: "thought must be a non-empty string" };
  }
  if (!payload.motorPlan || !Array.isArray(payload.motorPlan.primitives)) {
    return {
      ok: false,
      code: "missing_motor_plan",
      error: "motorPlan.primitives must be an array",
    };
  }

  const primitives: System2JsonOutput["motorPlan"]["primitives"] = [];
  for (const candidate of payload.motorPlan.primitives) {
    if (!candidate || typeof candidate !== "object") {
      return { ok: false, code: "invalid_primitive", error: "primitive must be an object" };
    }
    const primitive = candidate as {
      type?: string;
      target?: unknown;
      intensity?: unknown;
      durationTicks?: unknown;
    };
    if (
      !primitive.type ||
      !Object.values(ActuationType).includes(primitive.type as ActuationType)
    ) {
      return { ok: false, code: "invalid_primitive", error: "primitive.type is invalid" };
    }
    const target = parseTarget(primitive.target);
    if (!target) {
      return { ok: false, code: "invalid_primitive", error: "primitive.target is invalid" };
    }

    const rawIntensity =
      typeof primitive.intensity === "number" && Number.isFinite(primitive.intensity)
        ? primitive.intensity
        : 0.5;
    const rawDuration =
      typeof primitive.durationTicks === "number" && Number.isFinite(primitive.durationTicks)
        ? primitive.durationTicks
        : 1;

    primitives.push({
      type: primitive.type as ActuationType,
      target,
      intensity: clamp01(rawIntensity),
      durationTicks: Math.max(1, Math.floor(rawDuration)),
    });
  }

  const output: System2JsonOutput = {
    thought: payload.thought.trim(),
    motorPlan: { primitives },
  };
  if (typeof payload.vocalization === "string" && payload.vocalization.trim().length > 0) {
    output.vocalization = payload.vocalization.trim();
  }
  if (typeof payload.memoryNote === "string" && payload.memoryNote.trim().length > 0) {
    output.memoryNote = payload.memoryNote.trim();
  }

  return { ok: true, value: output };
}
