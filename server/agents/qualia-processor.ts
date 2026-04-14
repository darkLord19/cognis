import type {
  AgentState,
  CircadianState as CycleState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
  LexiconEntry,
  RawSensorBundle,
  WorldConfig,
} from "../../shared/types";
import { SENSOR_BUNDLE_LENGTH, SensorIndex, SensorSchemaVersion } from "../../shared/types";
import {
  BITTER_TASTE,
  CHEST_PRESSURE,
  ORAL_DRYNESS,
  PAIN_SHOCK,
  textForBand,
  VISCERAL_CONTRACTION,
} from "./qualia-templates";
import type { QualiaBand, QualiaFrame, QualiaSegment } from "./qualia-types";
import { validateQualiaOutput } from "./qualia-validator";
import { applySapirWhorfGate, enforceQualiaVeil } from "./qualia-veil";

export type QualiaInput = {
  agent: AgentState;
  rawSensorBundle: RawSensorBundle;
  lexicon: LexiconEntry[];
  tick: number;
  moodTint?: FeelingResidueTint;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function bandFor(value: number): QualiaBand {
  const v = clamp01(value);
  if (v < 0.12) return "silent";
  if (v < 0.32) return "whisper";
  if (v < 0.56) return "notable";
  if (v < 0.8) return "prominent";
  return "overwhelming";
}

function renderNarrative(segments: QualiaSegment[], moodTint?: FeelingResidueTint): string {
  const ordered = [
    ...segments.filter((segment) => segment.channel === "body"),
    ...segments.filter((segment) => segment.channel === "world"),
    ...segments.filter((segment) => segment.channel === "social"),
    ...segments.filter((segment) => segment.channel === "urge"),
    ...segments.filter((segment) => segment.channel === "memory"),
    ...segments.filter((segment) => segment.channel === "sound"),
    ...segments.filter((segment) => segment.channel === "taste"),
  ];

  let text = ordered
    .map((segment) => segment.text)
    .join(" ")
    .trim();
  if (moodTint) {
    if (moodTint.valence < -0.5) {
      text = `a heavy shade tints everything. ${text}`;
    } else if (moodTint.valence > 0.5) {
      text = `a faint lift moves through you. ${text}`;
    }
  }
  return enforceQualiaVeil(text);
}

function classifyAndRenderSegments(input: QualiaInput): QualiaSegment[] {
  const { rawSensorBundle, agent } = input;
  const readings = rawSensorBundle.readings;
  const segments: QualiaSegment[] = [];

  const oralBand = bandFor(readings[SensorIndex.OralDryness] ?? 0);
  const oralText = textForBand(ORAL_DRYNESS, oralBand);
  if (oralText) {
    segments.push({
      channel: "body",
      band: oralBand,
      text: oralText,
      conceptTags: ["oral_dryness"],
      sourceSensor: SensorIndex.OralDryness,
    });
  }

  const visceralBand = bandFor(readings[SensorIndex.VisceralContraction] ?? 0);
  const visceralText = textForBand(VISCERAL_CONTRACTION, visceralBand);
  if (visceralText) {
    segments.push({
      channel: "body",
      band: visceralBand,
      text: visceralText,
      conceptTags: ["visceral_contraction"],
      sourceSensor: SensorIndex.VisceralContraction,
    });
  }

  const chestBand = bandFor(readings[SensorIndex.ChestPressure] ?? 0);
  const chestText = textForBand(CHEST_PRESSURE, chestBand);
  if (chestText) {
    segments.push({
      channel: "body",
      band: chestBand,
      text: chestText,
      conceptTags: ["chest_pressure"],
      sourceSensor: SensorIndex.ChestPressure,
    });
  }

  const maxPain = Math.max(
    readings[SensorIndex.PainHead] ?? 0,
    readings[SensorIndex.PainTorso] ?? 0,
    readings[SensorIndex.PainLeftArm] ?? 0,
    readings[SensorIndex.PainRightArm] ?? 0,
    readings[SensorIndex.PainLeftLeg] ?? 0,
    readings[SensorIndex.PainRightLeg] ?? 0,
  );
  const painBand = bandFor(maxPain);
  const painText = textForBand(PAIN_SHOCK, painBand);
  if (painText) {
    segments.push({
      channel: "body",
      band: painBand,
      text: painText,
      conceptTags: ["pain"],
      sourceSensor: SensorIndex.PainTorso,
    });
  }

  const bitterBand = bandFor(readings[SensorIndex.Taste3] ?? 0);
  const bitterText = textForBand(BITTER_TASTE, bitterBand);
  if (bitterText) {
    segments.push({
      channel: "taste",
      band: bitterBand,
      text: bitterText,
      conceptTags: ["taste_bitter"],
      sourceSensor: SensorIndex.Taste3,
    });
  }

  const visibleRefs = rawSensorBundle.perceptualRefs.filter((ref) => ref.kind === "visible_entity");
  if (visibleRefs.length > 0) {
    const nearest = visibleRefs[0];
    const direction = nearest?.approximateDirection
      ? `to your ${nearest.approximateDirection}`
      : "nearby";
    segments.push({
      channel: "world",
      band: bandFor(nearest?.salience ?? 0.2),
      text: `a concrete presence holds ${direction}`,
      conceptTags: ["presence"],
    });
  }

  if (visibleRefs.length > 1) {
    segments.push({
      channel: "social",
      band: "notable",
      text: `${visibleRefs.length} other presences move at the edge of your awareness`,
      conceptTags: ["social_presence"],
    });
  }

  if (oralBand === "prominent" || oralBand === "overwhelming") {
    segments.push({
      channel: "urge",
      band: oralBand,
      text: "a compelling pull demands relief for the roughness in your throat",
      conceptTags: ["relief_drive"],
    });
  }

  const recentMemory = agent.episodicStore.at(-1)?.qualiaText;
  if (recentMemory) {
    segments.push({
      channel: "memory",
      band: "whisper",
      text: "a faint trace of a recent feeling lingers behind this moment",
      conceptTags: ["memory_trace"],
    });
  }

  return segments;
}

function buildFrame(input: QualiaInput, text: string, segments: QualiaSegment[]): QualiaFrame {
  return {
    agentId: input.agent.id,
    tick: input.tick,
    body: segments.filter((segment) => segment.channel === "body"),
    world: segments.filter((segment) => segment.channel === "world"),
    social: segments.filter((segment) => segment.channel === "social"),
    urges: segments.filter((segment) => segment.channel === "urge"),
    memories: segments.filter((segment) => segment.channel === "memory"),
    narratableText: text,
  };
}

export const QualiaProcessor = {
  process(input: QualiaInput): QualiaFrame {
    const segments = classifyAndRenderSegments(input);
    const gatedSegments = applySapirWhorfGate(segments, input.lexicon);
    const narratableText = renderNarrative(gatedSegments, input.moodTint);
    const validation = validateQualiaOutput(narratableText, input.lexicon);
    if (!validation.valid) {
      throw new Error(`Qualia veil violation: ${validation.violations.join(", ")}`);
    }
    return buildFrame(input, narratableText, gatedSegments);
  },

  // Legacy compatibility surface used by current orchestrator.
  qualiaFor(
    agent: AgentState,
    filteredPercept: FilteredPercept,
    _emotionalDetections: EmotionalFieldDetection[],
    moodTint: FeelingResidueTint,
    _cycleState: CycleState,
    _worldConfig: WorldConfig,
  ): string {
    const readings = new Float32Array(SENSOR_BUNDLE_LENGTH);
    const physiology = agent.body.physiology ?? {
      energyReserves: agent.body.energy,
      hydration: agent.body.hydration,
      oxygenSaturation: agent.body.oxygenation,
    };

    readings[SensorIndex.VisceralContraction] = clamp01(1 - physiology.energyReserves);
    readings[SensorIndex.OralDryness] = clamp01(1 - physiology.hydration);
    readings[SensorIndex.ChestPressure] = clamp01(1 - physiology.oxygenSaturation);

    readings[SensorIndex.PainHead] = agent.body.bodyMap.head.pain;
    readings[SensorIndex.PainTorso] = agent.body.bodyMap.torso.pain;
    readings[SensorIndex.PainLeftArm] = agent.body.bodyMap.leftArm.pain;
    readings[SensorIndex.PainRightArm] = agent.body.bodyMap.rightArm.pain;
    readings[SensorIndex.PainLeftLeg] = agent.body.bodyMap.leftLeg.pain;
    readings[SensorIndex.PainRightLeg] = agent.body.bodyMap.rightLeg.pain;

    if (agent.body.mouthItem?.materialId.includes("toxic_bitter")) {
      readings[SensorIndex.Taste3] = 0.95;
    }

    const perceptualRefs: RawSensorBundle["perceptualRefs"] = filteredPercept.primaryAttention.map(
      (other, index) => ({
        ref: `foreground_${index}`,
        kind: "visible_entity",
        operatorEntityId: other.id,
        salience: 0.5,
      }),
    );

    if (agent.body.mouthItem) {
      perceptualRefs.push({
        ref: "mouth_item",
        kind: "mouth_item",
        operatorMaterialId: agent.body.mouthItem.materialId,
        salience: 1,
      });
    }

    const frame = this.process({
      agent,
      rawSensorBundle: {
        schemaVersion: SensorSchemaVersion.V1,
        agentId: agent.id,
        tick: 0,
        readings,
        perceptualRefs,
      } as RawSensorBundle,
      lexicon: agent.lexicon ?? [],
      tick: 0,
      moodTint,
    });

    return frame.narratableText;
  },
};

export function resolveAgentReference(targetAgentId: string, observingAgent: AgentState): string {
  const relation = observingAgent.relationships?.find(
    (item) => item.targetAgentId === targetAgentId,
  );
  if (!relation) return "a stranger";
  if (relation.affinity > 0.5) return "a friend";
  if (relation.affinity < -0.5) return "an adversary";
  return "a familiar presence";
}
