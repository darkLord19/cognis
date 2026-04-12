import type { SpeciesConfig, WorldConfig } from "../../shared/types";

export type TripleBaselinePlan = {
  baseConfig: WorldConfig;
  configA: WorldConfig;
  configB: WorldConfig;
  configC: WorldConfig;
};

function cloneConfig(config: WorldConfig): WorldConfig {
  return structuredClone(config);
}

export const TripleBaseline = {
  spawn(
    worldConfig: WorldConfig,
    speciesPool: SpeciesConfig[] = worldConfig.species,
  ): TripleBaselinePlan {
    const hydratedSpecies =
      speciesPool.length > 0 ? speciesPool.map((species) => structuredClone(species)) : [];

    if (hydratedSpecies.length === 0) {
      throw new Error("No species definitions available for triple baseline runs");
    }

    const baseConfig = cloneConfig(worldConfig);
    baseConfig.species = hydratedSpecies.map((species) => structuredClone(species));

    const configA = cloneConfig(baseConfig);
    configA.meta.name = `${baseConfig.meta.name} A`;

    const configB = cloneConfig(baseConfig);
    configB.meta.name = `${baseConfig.meta.name} B`;
    configB.species = hydratedSpecies.map((species) => ({
      ...species,
      cognitiveTier: "pure_reflex",
    }));

    const configC = cloneConfig(baseConfig);
    configC.meta.name = `${baseConfig.meta.name} C`;
    configC.semanticMasking = {
      ...configC.semanticMasking,
      enabled: true,
      qualiaUsesRealLabels: false,
    };

    return { baseConfig, configA, configB, configC };
  },
};
