import type {
  AgentState,
  CircadianState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
  WorldConfig,
} from "../../shared/types";
import { enforceQualiaVeil } from "./qualia-veil";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function format(value: number): string {
  return value.toFixed(3);
}

function seasonScalar(season: CircadianState["season"]): number {
  if (season === "spring") return 0;
  if (season === "summer") return 0.33;
  if (season === "autumn") return 0.66;
  return 1;
}

function materialBand(material: string): number {
  if (material === "fire") return 780;
  if (material === "water") return 470;
  if (material === "food") return 620;
  if (material === "biomass") return 860;
  if (material === "waste") return 240;
  if (material === "ore") return 510;
  if (material === "wood") return 590;
  if (material === "stone") return 430;
  if (material === "dirt") return 540;
  return 0;
}

function conceptToken(agent: AgentState, concept: string): string {
  const match = agent.lexicon.find((entry) => entry.concept === concept);
  return match?.word ?? "undifferentiated";
}

function maxNociception(agent: AgentState): number {
  const values = Object.values(agent.body.bodyMap ?? {}).map((part) => part.pain ?? 0);
  return values.length === 0 ? 0 : Math.max(...values);
}

function threatLoad(body: FilteredPercept["ownBody"]): number {
  const health = clamp01(body.health ?? 1);
  const fatigue = clamp01(body.fatigue ?? 0);
  const thirst = clamp01(body.thirst ?? 0);
  const tempDelta = Math.abs((body.coreTemperature ?? 15) - 15) / 20;
  return clamp01((1 - health + fatigue + thirst + clamp01(tempDelta)) / 4);
}

function bodyVector(body: FilteredPercept["ownBody"]): string {
  const map = body.bodyMap;
  return [
    format(map.head.pain),
    format(map.torso.pain),
    format(map.leftArm.pain),
    format(map.rightArm.pain),
    format(map.leftLeg.pain),
    format(map.rightLeg.pain),
  ].join(",");
}

function ambientVector(circadianState: CircadianState): string {
  return [
    format(clamp01(circadianState.lightLevel)),
    format(clamp01(circadianState.cycleHormoneValue)),
    format(clamp01((circadianState.surfaceTemperatureDelta + 20) / 40)),
    format(seasonScalar(circadianState.season)),
  ].join(",");
}

function affectVector(
  moodTint: FeelingResidueTint,
  emotionalDetections: EmotionalFieldDetection[],
): string {
  const localValence = clamp01((moodTint.valence + 1) / 2);
  const localArousal = clamp01((moodTint.arousal + 1) / 2);

  if (emotionalDetections.length === 0) {
    return [format(localValence), format(localArousal), "0.000", "0.000"].join(",");
  }

  const extValence =
    emotionalDetections.reduce((sum, detection) => sum + detection.valenceImpression, 0) /
    emotionalDetections.length;
  const extArousal =
    emotionalDetections.reduce((sum, detection) => sum + detection.arousalImpression, 0) /
    emotionalDetections.length;

  return [
    format(localValence),
    format(localArousal),
    format(clamp01((extValence + 1) / 2)),
    format(clamp01((extArousal + 1) / 2)),
  ].join(",");
}

function socialSignalVector(agent: AgentState, filteredPercept: FilteredPercept): string {
  if (filteredPercept.primaryAttention.length === 0) {
    return `prox=0|periph=${filteredPercept.peripheralAwareness.count}`;
  }

  const packed = filteredPercept.primaryAttention
    .map((other) => {
      const relation = resolveAgentReference(other.id, agent);
      const arousal = format(clamp01((other.body.arousal + 1) / 2));
      const valence = format(clamp01((other.body.valence + 1) / 2));
      return `${relation}:${valence}:${arousal}`;
    })
    .join(";");

  return `prox=${filteredPercept.primaryAttention.length}|periph=${filteredPercept.peripheralAwareness.count}|field=${packed}`;
}

function externalSignalVector(agent: AgentState, filteredPercept: FilteredPercept): string {
  if (filteredPercept.focusedVoxels.length === 0) {
    return "exo=none";
  }

  const packed = filteredPercept.focusedVoxels
    .map((voxel) => {
      if (voxel.material === "biomass") {
        const intensity = clamp01((voxel.temperature + 30) / 120);
        return `A heavy metallic sweetness resonates at ${format(intensity)}`;
      }

      const wave = materialBand(voxel.material);
      const intensity = clamp01((voxel.temperature + 30) / 120);
      const token = conceptToken(agent, voxel.material);
      return `${wave}:${format(intensity)}:${token}`;
    })
    .join(";");

  return `exo=${packed}`;
}

export function resolveAgentReference(targetAgentId: string, observingAgent: AgentState): string {
  const relation = observingAgent.relationships?.find(
    (item) => item.targetAgentId === targetAgentId,
  );
  if (!relation) return "unknown";

  const affinity = relation.affinity ?? 0;
  const trust = relation.trust ?? 0;
  const fear = relation.fear ?? 0;
  const encounters = relation.significantEvents?.length ?? 0;

  if (fear > 0.5) return "threat";
  if (encounters === 0) return "novel";
  if (affinity > 0.7 && trust > 0.6) return "bonded";
  if (affinity > 0.3) return "familiar";
  if (affinity < -0.3) return "averse";
  return "known";
}

export const QualiaProcessor = {
  qualiaFor(
    agent: AgentState,
    filteredPercept: FilteredPercept,
    emotionalDetections: EmotionalFieldDetection[],
    moodTint: FeelingResidueTint,
    circadianState: CircadianState,
    worldConfig: WorldConfig,
  ): string {
    const omega = worldConfig.freeWill?.survivalDriveWeight ?? 1;
    const hunger = clamp01(filteredPercept.ownBody.hunger ?? 0);
    const thirst = clamp01(filteredPercept.ownBody.thirst ?? 0);
    const nociception = maxNociception(agent);
    const threat = threatLoad(filteredPercept.ownBody);
    const integrityImpact = omega * clamp01(hunger + nociception + threat);

    const lines = [
      `interoceptive_map(h1=${format(hunger)},t1=${format(thirst)},n1=${format(nociception)},q=[${bodyVector(filteredPercept.ownBody)}],impact=${format(integrityImpact)})`,
      `ambient_map(a=[${ambientVector(circadianState)}])`,
      `affect_map(a=[${affectVector(moodTint, emotionalDetections)}])`,
      `social_map(${socialSignalVector(agent, filteredPercept)})`,
      `exo_map(${externalSignalVector(agent, filteredPercept)})`,
    ];

    let output = lines.join(" | ");

    if (worldConfig.semanticMasking.enabled && !worldConfig.semanticMasking.qualiaUsesRealLabels) {
      for (const [source, target] of Object.entries(worldConfig.semanticMasking.sensorLabelMap)) {
        const expression = new RegExp(`\\b${source}\\b`, "gi");
        output = output.replace(expression, target);
      }
    }

    return enforceQualiaVeil(output);
  },
};
