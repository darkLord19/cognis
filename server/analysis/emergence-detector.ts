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

  private normalize(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  public registerKnownBehaviour(behaviourName: string): void {
    this.knownBehaviours.add(this.normalize(behaviourName));
  }

  public detectNovelty(behaviourName: string): boolean {
    return !this.knownBehaviours.has(this.normalize(behaviourName));
  }
}
