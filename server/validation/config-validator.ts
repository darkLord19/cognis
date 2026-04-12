export function validateWorldConfig(raw: unknown): string[] {
  const errors: string[] = [];
  const c = (raw ?? {}) as Record<string, unknown>;

  if (!c.meta) errors.push("Missing required field: meta");
  if (!c.physics) errors.push("Missing required field: physics");

  const agents = c.agents as Record<string, unknown> | undefined;
  if (!agents) {
    errors.push("Missing required field: agents");
  } else {
    if (typeof agents.count !== "number") errors.push("agents.count must be a number");
    if (typeof agents.speciesId !== "string") errors.push("agents.speciesId must be a string");
    if (agents.initialCount !== undefined)
      errors.push("agents.initialCount is not a valid field — use agents.count");
    if (agents.startingMode !== undefined)
      errors.push("agents.startingMode is not valid here — use language.startingMode");
  }

  const lang = c.language as Record<string, unknown> | undefined;
  if (lang) {
    if (lang.stagesEnabled !== undefined)
      errors.push("language.stagesEnabled is not valid — use language.maxEmergenceStage");
    if (lang.driftRate !== undefined)
      errors.push("language.driftRate is not valid — use language.dialectDivergenceEnabled");
  }

  const elements = c.elements as Record<string, unknown> | undefined;
  if (elements && typeof elements.fireSpreadRate === "number") {
    errors.push(
      "elements.fireSpreadRate is not valid — use elements.fire.spreadRateTicksPerVoxel",
    );
  }

  const species = c.species as unknown[] | undefined;
  if (!Array.isArray(species) || species.length === 0) {
    errors.push("species must include at least one species reference");
  } else {
    const invalidSpeciesEntries = species.some((entry) => {
      const value = entry as Record<string, unknown>;
      return typeof value?.id !== "string" && typeof value?.$ref !== "string";
    });
    if (invalidSpeciesEntries) {
      errors.push("species entries must include either an id or a $ref");
    }
  }

  return errors;
}
