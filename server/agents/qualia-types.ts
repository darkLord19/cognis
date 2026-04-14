import type { SensorIndex } from "../../shared/types";

export type QualiaBand = "silent" | "whisper" | "notable" | "prominent" | "overwhelming";

export type QualiaSegment = {
  channel: "body" | "world" | "social" | "urge" | "memory" | "sound" | "taste";
  band: QualiaBand;
  text: string;
  conceptTags: string[];
  sourceSensor?: SensorIndex;
};

export type QualiaFrame = {
  agentId: string;
  tick: number;
  body: QualiaSegment[];
  world: QualiaSegment[];
  social: QualiaSegment[];
  urges: QualiaSegment[];
  memories: QualiaSegment[];
  narratableText: string;
};
