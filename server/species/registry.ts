import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpeciesConfig } from "../../shared/types";

export class SpeciesRegistry {
  private species: Map<string, SpeciesConfig> = new Map();

  public loadAll(): void {
    const dir = join(process.cwd(), "data/species");
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const config = JSON.parse(readFileSync(join(dir, file), "utf8")) as SpeciesConfig;
        this.species.set(config.id, config);
      }
    }
  }

  public get(id: string): SpeciesConfig | undefined {
    return this.species.get(id);
  }

  public getAll(): SpeciesConfig[] {
    return Array.from(this.species.values());
  }
}
