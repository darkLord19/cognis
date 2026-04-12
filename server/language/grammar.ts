import type { GrammarRule } from "../../shared/types";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class GrammarEngine {
  public static detectRule(_utterances: string[]): GrammarRule | null {
    // Simplified grammar rule detection (placeholder)
    return null;
  }
}
