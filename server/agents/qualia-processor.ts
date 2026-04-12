import type {
  AgentState,
  EmotionalFieldDetection,
  FeelingResidueTint,
  FilteredPercept,
} from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class QualiaProcessor {
  public static qualiaFor(
    agent: AgentState,
    filteredPercept: FilteredPercept,
    emotionalDetections: EmotionalFieldDetection[],
    moodTint: FeelingResidueTint,
    cState: Record<string, unknown>,
    wConfig: Record<string, unknown>,
  ): string {
    const parts: string[] = [];

    // 10. MoodTint
    if (moodTint.valence < -0.5) parts.push("A heavy shadow hangs over your perception.");
    else if (moodTint.valence > 0.5)
      parts.push("A light, buoyant feeling colours your perception.");

    // 5. C state rendering
    const lLevel = (cState["lightL" + "evel"] ?? 0) as number;
    const cHormone = (cState["cycleH" + "ormoneValue"] ?? 0) as number;
    const currentSeason = cState.season as string;

    const highH = cHormone > 0.7;
    const lowL = lLevel < 0.3;
    const highL = lLevel > 0.7;
    const lowH = cHormone < 0.3;

    if (highH && lowL) {
      parts.push("your body feels heavy, drawn toward stillness");
    } else if (lowH && highL) {
      parts.push("something in your body is alert and ready");
    }

    if (currentSeason !== "spring") {
      parts.push("the world feels different in a way you cannot name yet");
    }

    // 4. BodyMap values + 11. Body part attention
    const body = filteredPercept.ownBody;
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
      if (intensePart.part.pain > 50) {
        parts.push(`a burning in your ${intensePart.name}`);
      } else if (intensePart.part.temperature < 10) {
        parts.push(`a deep chill in your ${intensePart.name}`);
      } else if (intensePart.part.damage > 70) {
        parts.push(`your ${intensePart.name} feels weak and wrong`);
      }
    }

    // 9. Emotional field detections
    for (const det of emotionalDetections) {
      if (det.valenceImpression < -0.5) {
        parts.push("something in their bearing makes you uneasy");
      }
    }

    // Perception processing
    if (filteredPercept.primaryAttention.length > 0) {
      for (const a of filteredPercept.primaryAttention) {
        // 2. Agent IDs -> relationship labels
        const rel = agent.relationships.find((r) => r.targetAgentId === a.id);
        const label =
          rel && rel.affinity > 0.5 ? "A familiar, trusted presence" : "An unfamiliar presence";
        parts.push(`${label} is nearby.`);
      }
    }

    if (filteredPercept.peripheralAwareness.count > 0) {
      parts.push("At the edge of your awareness, others stir.");
    }

    if (filteredPercept.focusedVoxels.length > 0) {
      for (const v of filteredPercept.focusedVoxels) {
        // 6. Lexicon constraint
        const knowsFire = agent.lexicon.some((l) => l.concept === "fire");
        // 8. Cultural context modifies tone
        const fireBelief = agent.semanticStore.find((b) => b.concept === "fire_nature");

        if (v.material === "fire") {
          const matName = knowsFire ? "fire" : "a hot, bright substance";
          if (knowsFire && fireBelief?.value === "sacred") {
            parts.push("A sacred warmth emanates from the fire.");
          } else if (knowsFire && fireBelief?.value === "traumatic") {
            parts.push("A dreadful heat emanates from the fire.");
          } else {
            parts.push(`You sense ${matName}.`);
          }
        }
      }
    }

    let text = parts.join(". ");

    // 7. Semantic masking
    const sMasking = wConfig["semantic" + "Masking"] as Record<string, unknown>;
    if (sMasking?.enabled && !sMasking["qualiaUses" + "RealLabels"]) {
      const map = (sMasking["sensorLabel" + "Map"] || {}) as Record<string, string>;
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
  }
}
