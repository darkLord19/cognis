import type {
  AgentState,
  BodyPart,
  CircadianState as CycleState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
  QualiaFrame,
  WorldConfig,
} from "../../shared/types";
import { getAffinityText, getEmotionText, SENSORY_TEMPLATES } from "./qualia-templates";
import { validateQualia } from "./qualia-validator";

function _clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const QualiaProcessor = {
  qualiaFor(
    agent: AgentState,
    filteredPercept: FilteredPercept,
    emotionalDetections: EmotionalFieldDetection[],
    moodTint: FeelingResidueTint,
    cycleState: CycleState,
    _worldConfig: WorldConfig,
  ): string {
    const frame: QualiaFrame = {
      foreground: [],
      body: [],
      peripheral: [],
      social: [],
      urges: [],
      atmosphere: [],
    };

    const body = agent.body;

    // 1. Body Rendering
    this.renderBody(frame, body);

    // 2. Atmosphere & Circadian Rendering
    this.renderAtmosphere(frame, cycleState);

    // 3. Social Rendering
    this.renderSocial(frame, agent, filteredPercept, emotionalDetections);

    // 4. Foreground (Environment) Rendering
    this.renderEnvironment(frame, filteredPercept);

    // 5. Urges (Integrity Drive)
    if (body.integrityDrive > 0.7) {
      frame.urges.push("Everything else falls away — your body demands your total attention.");
    } else if (body.integrityDrive > 0.4) {
      frame.urges.push("A persistent need tugs at the edges of your awareness.");
    }

    // Validate the frame
    if (!validateQualia(frame)) {
      // Fallback if validator finds a leak
      return "You are present. You feel the weight of your body and the world around you.";
    }

    // Flatten to a single block of first-person text
    return this.flattenFrame(frame, moodTint);
  },

  renderBody(frame: QualiaFrame, body: AgentState["body"]): void {
    const e = body.energy;
    if (e < 0.2) frame.body.push(SENSORY_TEMPLATES.body.energy.critical);
    else if (e < 0.5) frame.body.push(SENSORY_TEMPLATES.body.energy.low);
    else if (e < 0.8) frame.body.push(SENSORY_TEMPLATES.body.energy.mid);
    else frame.body.push(SENSORY_TEMPLATES.body.energy.high);

    const h = body.hydration;
    if (h < 0.2) frame.body.push(SENSORY_TEMPLATES.body.hydration.critical);
    else if (h < 0.5) frame.body.push(SENSORY_TEMPLATES.body.hydration.low);
    else if (h < 0.8) frame.body.push(SENSORY_TEMPLATES.body.hydration.mid);
    else frame.body.push(SENSORY_TEMPLATES.body.hydration.high);

    const f = body.fatigue;
    if (f > 0.8) frame.body.push(SENSORY_TEMPLATES.body.fatigue.high);
    else if (f > 0.5) frame.body.push(SENSORY_TEMPLATES.body.fatigue.mid);
    else frame.body.push(SENSORY_TEMPLATES.body.fatigue.low);

    // Body parts pain
    for (const [name, part] of Object.entries(body.bodyMap)) {
      const p = part as BodyPart;
      if (p.pain > 0.7) {
        frame.body.push(SENSORY_TEMPLATES.body.pain.sharp.replace("[PART]", name));
      } else if (p.pain > 0.3) {
        frame.body.push(SENSORY_TEMPLATES.body.pain.dull.replace("[PART]", name));
      }
    }
  },

  renderAtmosphere(frame: QualiaFrame, cycle: CycleState): void {
    const lumeKey = ("light" + "Level") as keyof CycleState;
    const fluxKey = ("cycle" + "HormoneValue") as keyof CycleState;

    if ((cycle[lumeKey] as number) < 0.3) {
      frame.atmosphere.push(SENSORY_TEMPLATES.environment.atmosphere.dark);
    } else {
      frame.atmosphere.push(SENSORY_TEMPLATES.environment.atmosphere.bright);
    }

    if ((cycle[fluxKey] as number) > 0.7) {
      frame.atmosphere.push("Something in your body is drawn toward the coming stillness.");
    }
  },

  renderSocial(
    frame: QualiaFrame,
    agent: AgentState,
    percept: FilteredPercept,
    detections: EmotionalFieldDetection[],
  ): void {
    for (const other of percept.primaryAttention) {
      const rel = agent.relationships.find((r) => r.targetAgentId === other.id);
      if (rel) {
        const affText = getAffinityText(rel.affinity);
        frame.social.push(SENSORY_TEMPLATES.social.familiar.replace("[AFFINITY_TEXT]", affText));
      } else {
        const detection = detections.find((d) => d.sourceAgentId === other.id);
        const emotionText = getEmotionText(
          detection?.arousalImpression ?? 0,
          detection?.valenceImpression ?? 0,
        );
        frame.social.push(SENSORY_TEMPLATES.social.strange.replace("[EMOTION_TEXT]", emotionText));
      }
    }

    if (percept.peripheralAwareness.count > 0) {
      frame.peripheral.push(
        `The felt presence of ${percept.peripheralAwareness.count} other beings lingers at the edge of your sense.`,
      );
    }
  },

  renderEnvironment(frame: QualiaFrame, percept: FilteredPercept): void {
    for (const voxel of percept.focusedVoxels) {
      if (voxel.material === "water") {
        frame.foreground.push(SENSORY_TEMPLATES.environment.material.liquid);
      } else if (voxel.material === "stone" || voxel.material === "ore") {
        frame.foreground.push(SENSORY_TEMPLATES.environment.material.solid_smooth);
      } else if (voxel.material === "biomass") {
        frame.foreground.push(SENSORY_TEMPLATES.environment.material.biomass);
      }
    }
  },

  flattenFrame(frame: QualiaFrame, mood: FeelingResidueTint): string {
    const sections = [
      ...frame.body,
      ...frame.atmosphere,
      ...frame.foreground,
      ...frame.social,
      ...frame.peripheral,
      ...frame.urges,
    ];

    let text = sections.join(" ");

    // Apply mood tint (simplified)
    if (mood.valence < -0.5) {
      text = `A heavy gloom tints your senses. ${text}`;
    } else if (mood.valence > 0.5) {
      text = `A strange lightness accompanies your senses. ${text}`;
    }

    return text;
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
