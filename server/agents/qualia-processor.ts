import {
  BODY_COLD_THRESHOLD,
  BODY_DAMAGE_THRESHOLD,
  BODY_PAIN_THRESHOLD,
  CYCLE_HORMONE_HIGH,
  CYCLE_HORMONE_LOW,
  EMOTIONAL_FIELD_NEGATIVE_THRESHOLD,
  HUNGER_MILD_THRESHOLD,
  HUNGER_STRONG_THRESHOLD,
  LIGHT_LEVEL_HIGH,
  LIGHT_LEVEL_LOW,
  MOOD_NEGATIVE_THRESHOLD,
  MOOD_POSITIVE_THRESHOLD,
  THIRST_MILD_THRESHOLD,
  THIRST_STRONG_THRESHOLD,
} from "../../shared/constants";
import type {
  AgentState,
  CircadianState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
  WorldConfig,
} from "../../shared/types";

// --- Template Engine ---

type LexiconTier = "pre_verbal" | "basic" | "intermediate" | "advanced";

function getLexiconTier(lexiconSize: number): LexiconTier {
  if (lexiconSize === 0) return "pre_verbal";
  if (lexiconSize <= 5) return "basic";
  if (lexiconSize <= 20) return "intermediate";
  return "advanced";
}

type TemplateCategory =
  | "mood_negative"
  | "mood_positive"
  | "body_heavy"
  | "body_alert"
  | "season_change"
  | "pain"
  | "cold"
  | "damage"
  | "hunger_mild"
  | "hunger_strong"
  | "thirst_mild"
  | "thirst_strong"
  | "other_uneasy"
  | "other_familiar"
  | "other_stranger"
  | "peripheral"
  | "fire_unknown"
  | "fire_known"
  | "fire_sacred"
  | "fire_traumatic"
  | "water_nearby"
  | "food_nearby"
  | "pleasure";

const QUALIA_TEMPLATES: Record<TemplateCategory, Record<LexiconTier, string[]>> = {
  mood_negative: {
    pre_verbal: ["A heavy shadow presses down."],
    basic: ["A heavy shadow hangs over your perception."],
    intermediate: ["A dark weight settles across everything you see and feel."],
    advanced: [
      "A pervasive heaviness colours your awareness, darkening every impression.",
      "Something burdensome clings to your thoughts, shadowing all else.",
    ],
  },
  mood_positive: {
    pre_verbal: ["A lightness lifts through you."],
    basic: ["A light, buoyant feeling colours your perception."],
    intermediate: ["A gentle warmth and ease suffuses your awareness."],
    advanced: [
      "An uplifting clarity brightens your perception, as though a veil has lifted.",
      "You feel a quiet elation, everything seeming open and possible.",
    ],
  },
  body_heavy: {
    pre_verbal: ["Heaviness. Drawn to stillness."],
    basic: ["Your body feels heavy, drawn toward stillness."],
    intermediate: ["Your limbs grow leaden, your thoughts sluggish, pulled toward rest."],
    advanced: [
      "A deep weariness pervades your being, each movement requiring deliberate effort.",
      "Your body insists on stillness, as though the darkness itself weighs upon your bones.",
    ],
  },
  body_alert: {
    pre_verbal: ["Alert. Ready."],
    basic: ["Something in your body is alert and ready."],
    intermediate: ["Your senses sharpen, your muscles tighten with readiness."],
    advanced: [
      "A crisp vitality flows through you, every nerve tuned to the world.",
      "You feel primed, aware, as if the brightness has ignited something within.",
    ],
  },
  season_change: {
    pre_verbal: ["Different. Changed."],
    basic: ["The world feels different in a way you cannot name yet."],
    intermediate: ["Something has shifted in the rhythm of things around you."],
    advanced: [
      "The quality of air, the texture of light — everything whispers of a change you cannot yet articulate.",
    ],
  },
  pain: {
    pre_verbal: ["Burning!"],
    basic: ["A burning in your {bodyPart}."],
    intermediate: ["A sharp, insistent burning radiates from your {bodyPart}."],
    advanced: [
      "A fierce, pulsing heat throbs in your {bodyPart}, demanding all your attention.",
      "Pain lances through your {bodyPart} like hot iron, impossible to ignore.",
    ],
  },
  cold: {
    pre_verbal: ["Cold! Deep cold."],
    basic: ["A deep chill in your {bodyPart}."],
    intermediate: ["A biting coldness has seeped into your {bodyPart}, numbing and aching."],
    advanced: [
      "An invasive, bone-deep cold grips your {bodyPart}, as if warmth itself has abandoned it.",
    ],
  },
  damage: {
    pre_verbal: ["Wrong. Weak."],
    basic: ["Your {bodyPart} feels weak and wrong."],
    intermediate: ["Your {bodyPart} responds sluggishly, something fundamentally wrong within it."],
    advanced: [
      "A deep wrongness emanates from your {bodyPart} — it no longer functions as it should.",
    ],
  },
  hunger_mild: {
    pre_verbal: ["Empty inside."],
    basic: ["A hollow feeling gnaws at your centre."],
    intermediate: ["A quiet emptiness stirs in your belly, a slow pull toward sustenance."],
    advanced: [
      "An insistent hollowness echoes through your core, a steady undercurrent beneath all thought.",
    ],
  },
  hunger_strong: {
    pre_verbal: ["Hunger! Consuming."],
    basic: ["A desperate hunger claws at your insides."],
    intermediate: ["Hunger grips you fiercely, your body screaming for nourishment."],
    advanced: [
      "A ravenous void consumes your attention, every other concern shrinking before this primal demand.",
      "Your body is devouring itself from within, an urgent, all-encompassing need.",
    ],
  },
  thirst_mild: {
    pre_verbal: ["Dry. Need."],
    basic: ["A dryness scratches at the back of your awareness."],
    intermediate: ["A parched tightness grips your throat, a quiet yearning for moisture."],
    advanced: [
      "A subtle but persistent desiccation pulls at your attention, a thirst building beneath the surface.",
    ],
  },
  thirst_strong: {
    pre_verbal: ["Thirst! Cracking."],
    basic: ["An unbearable thirst cracks your awareness wide open."],
    intermediate: [
      "Your mouth is dust, your thoughts fragmenting around the consuming need for water.",
    ],
    advanced: [
      "Every fibre of your being cries out for moisture, a desperate, cracking thirst that obliterates all else.",
    ],
  },
  other_uneasy: {
    pre_verbal: ["Danger? Uneasy."],
    basic: ["Something in their bearing makes you uneasy."],
    intermediate: ["An undercurrent of tension radiates from them, setting your nerves on edge."],
    advanced: [
      "You sense a disturbance in their emotional field — something dark, something unsettled.",
    ],
  },
  other_familiar: {
    pre_verbal: ["Known. Safe."],
    basic: ["A familiar, trusted presence is nearby."],
    intermediate: [
      "Someone you know and trust moves within your awareness, a comforting solidity.",
    ],
    advanced: [
      "A presence you have come to rely upon is near — their familiar emotional signature a quiet reassurance.",
    ],
  },
  other_stranger: {
    pre_verbal: ["Unknown. There."],
    basic: ["An unfamiliar presence is nearby."],
    intermediate: [
      "An unknown being occupies the edge of your awareness, their intentions unreadable.",
    ],
    advanced: [
      "A stranger moves near you, their emotional field novel and uncharted, provoking cautious curiosity.",
    ],
  },
  peripheral: {
    pre_verbal: ["Others. Edge."],
    basic: ["At the edge of your awareness, others stir."],
    intermediate: ["Beyond your immediate attention, you sense the dim murmur of other presences."],
    advanced: [
      "A penumbra of activity flickers at the margins of your consciousness — others, numerous but indistinct.",
    ],
  },
  fire_unknown: {
    pre_verbal: ["Hot! Bright!"],
    basic: ["You sense a hot, bright substance."],
    intermediate: [
      "A fierce, dancing heat and blinding brightness emanates from something nearby.",
    ],
    advanced: ["Something radiates intense warmth and light — mesmerising, dangerous, unnamed."],
  },
  fire_known: {
    pre_verbal: ["Fire!"],
    basic: ["You sense fire nearby."],
    intermediate: [
      "Fire burns nearby, its familiar warmth and dance of light filling your senses.",
    ],
    advanced: ["The crackle and glow of fire reaches you — known, named, a force you understand."],
  },
  fire_sacred: {
    pre_verbal: ["Sacred warmth."],
    basic: ["A sacred warmth emanates from the fire."],
    intermediate: ["The fire burns with a reverence, its warmth touched by something deeper."],
    advanced: [
      "The sacred fire radiates an awe you feel deep in your being, its warmth transcendent.",
    ],
  },
  fire_traumatic: {
    pre_verbal: ["Dread! Hot!"],
    basic: ["A dreadful heat emanates from the fire."],
    intermediate: ["The fire awakens a deep dread within you, its heat carrying echoes of pain."],
    advanced: [
      "Terror lances through you at the sight of flames — memory and instinct converging in visceral alarm.",
    ],
  },
  water_nearby: {
    pre_verbal: ["Wet. Cool."],
    basic: ["You sense the cool presence of water."],
    intermediate: ["The faint sheen and cool touch of water reaches your awareness."],
    advanced: [
      "Water is near — you feel its cool promise, its fluidity a contrast to the solid world.",
    ],
  },
  food_nearby: {
    pre_verbal: ["Food! There."],
    basic: ["Something nearby promises nourishment."],
    intermediate: ["The subtle signal of sustenance reaches you — something edible is close."],
    advanced: [
      "Your body responds to the proximity of food, a primal recognition stirring beneath thought.",
    ],
  },
  pleasure: {
    pre_verbal: ["Good. Warm."],
    basic: ["A wave of warmth and contentment flows through you."],
    intermediate: [
      "A deep satisfaction settles through your body, muscles releasing their tension.",
    ],
    advanced: [
      "Pure, unguarded pleasure radiates through every part of you, a rare and precious ease.",
    ],
  },
};

function pickTemplate(category: TemplateCategory, tier: LexiconTier): string {
  const templates = QUALIA_TEMPLATES[category][tier];
  return templates[Math.floor(Math.random() * templates.length)] ?? templates[0] ?? "";
}

export function resolveAgentReference(targetAgentId: string, observingAgent: AgentState): string {
  const relationship = observingAgent.relationships?.find((r) => r.targetAgentId === targetAgentId);

  if (!relationship) {
    return "an unknown presence";
  }

  const affinity = relationship.affinity ?? 0;
  const trust = relationship.trust ?? 0;
  const interactionCount = relationship.significantEvents?.length ?? 0;

  if (interactionCount === 0) return "a stranger";
  if (affinity > 0.7 && trust > 0.6) return "someone you trust";
  if (affinity > 0.4) return "a familiar presence";
  if (affinity < -0.3) return "someone whose presence unsettles you";
  if ((relationship.fear ?? 0) > 0.5) return "someone you fear";
  return "a known presence nearby";
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
    const parts: string[] = [];
    const tier = getLexiconTier(agent.lexicon.length);

    // 10. MoodTint
    if (moodTint.valence < MOOD_NEGATIVE_THRESHOLD) parts.push(pickTemplate("mood_negative", tier));
    else if (moodTint.valence > MOOD_POSITIVE_THRESHOLD)
      parts.push(pickTemplate("mood_positive", tier));

    // 5. Circadian state rendering (uses typed CircadianState)
    const cHormone = circadianState.cycleHormoneValue;
    const lLevel = circadianState.lightLevel;
    const currentSeason = circadianState.season;

    if (cHormone > CYCLE_HORMONE_HIGH && lLevel < LIGHT_LEVEL_LOW) {
      parts.push(pickTemplate("body_heavy", tier));
    } else if (cHormone < CYCLE_HORMONE_LOW && lLevel > LIGHT_LEVEL_HIGH) {
      parts.push(pickTemplate("body_alert", tier));
    }

    if (currentSeason !== "spring") {
      parts.push(pickTemplate("season_change", tier));
    }

    // 15. Hunger / thirst rendering
    const body = filteredPercept.ownBody;
    if (body.hunger > HUNGER_STRONG_THRESHOLD) {
      parts.push(pickTemplate("hunger_strong", tier));
    } else if (body.hunger > HUNGER_MILD_THRESHOLD) {
      parts.push(pickTemplate("hunger_mild", tier));
    }

    if (body.thirst > THIRST_STRONG_THRESHOLD) {
      parts.push(pickTemplate("thirst_strong", tier));
    } else if (body.thirst > THIRST_MILD_THRESHOLD) {
      parts.push(pickTemplate("thirst_mild", tier));
    }

    // Pleasure
    if (body.valence > MOOD_POSITIVE_THRESHOLD && body.arousal > MOOD_POSITIVE_THRESHOLD) {
      parts.push(pickTemplate("pleasure", tier));
    }

    // 4. BodyMap values + 11. Body part attention
    const partsArray = [
      { name: "head", part: body.bodyMap.head },
      { name: "chest", part: body.bodyMap.torso },
      { name: "left arm", part: body.bodyMap.leftArm },
      { name: "right arm", part: body.bodyMap.rightArm },
      { name: "left leg", part: body.bodyMap.leftLeg },
      { name: "right leg", part: body.bodyMap.rightLeg },
    ].sort((a, b) => Math.max(b.part.pain, b.part.damage) - Math.max(a.part.pain, a.part.damage));

    const intensePart = partsArray[0];
    if (intensePart) {
      if (intensePart.part.pain > BODY_PAIN_THRESHOLD) {
        parts.push(pickTemplate("pain", tier).replace("{bodyPart}", intensePart.name));
      } else if (intensePart.part.temperature < BODY_COLD_THRESHOLD) {
        parts.push(pickTemplate("cold", tier).replace("{bodyPart}", intensePart.name));
      } else if (intensePart.part.damage > BODY_DAMAGE_THRESHOLD) {
        parts.push(pickTemplate("damage", tier).replace("{bodyPart}", intensePart.name));
      }
    }

    // 9. Emotional field detections
    for (const det of emotionalDetections) {
      if (det.valenceImpression < EMOTIONAL_FIELD_NEGATIVE_THRESHOLD) {
        parts.push(pickTemplate("other_uneasy", tier));
      }
    }

    // Perception processing
    if (filteredPercept.primaryAttention.length > 0) {
      for (const a of filteredPercept.primaryAttention) {
        parts.push(`${resolveAgentReference(a.id, agent)} is nearby`);
      }
    }

    if (filteredPercept.peripheralAwareness.count > 0) {
      parts.push(pickTemplate("peripheral", tier));
    }

    if (filteredPercept.focusedVoxels.length > 0) {
      for (const v of filteredPercept.focusedVoxels) {
        // 6. Lexicon constraint
        const knowsFire = agent.lexicon.some((l) => l.concept === "fire");
        // 8. Cultural context modifies tone
        const fireBelief = agent.semanticStore.find((b) => b.concept === "fire_nature");

        if (v.material === "fire") {
          if (knowsFire && fireBelief?.value === "sacred") {
            parts.push(pickTemplate("fire_sacred", tier));
          } else if (knowsFire && fireBelief?.value === "traumatic") {
            parts.push(pickTemplate("fire_traumatic", tier));
          } else if (knowsFire) {
            parts.push(pickTemplate("fire_known", tier));
          } else {
            parts.push(pickTemplate("fire_unknown", tier));
          }
        } else if (v.material === "water") {
          parts.push(pickTemplate("water_nearby", tier));
        } else if (v.material === "food") {
          parts.push(pickTemplate("food_nearby", tier));
        }
      }
    }

    let text = parts.join(". ");

    // 7. Semantic masking
    if (worldConfig.semanticMasking.enabled && !worldConfig.semanticMasking.qualiaUsesRealLabels) {
      const map = worldConfig.semanticMasking.sensorLabelMap;
      for (const realLabel of Object.keys(map)) {
        const maskedToken = map[realLabel];
        if (maskedToken) {
          // Only replace if it's a word boundary to prevent partial matches
          const regex = new RegExp(`\\b${realLabel}\\b`, "gi");
          text = text.replace(regex, maskedToken);
        }
      }
    }

    return text;
  },
};
