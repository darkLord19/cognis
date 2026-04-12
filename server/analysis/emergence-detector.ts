export class EmergenceDetector {
  private knownBehaviours: Set<string> = new Set([
    "basic_tool_use",
    "fire_making",
    "shelter_building",
    "food_sharing",
    "pain_avoidance",
    "predator_flight",
    "social_grooming",
  ]);

  public detectNovelty(behaviourName: string): boolean {
    return !this.knownBehaviours.has(behaviourName);
  }
}
