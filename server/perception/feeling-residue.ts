import type { FeelingResidue, FeelingResidueTint } from "../../shared/types";

export const FeelingResidueSystem = {
  getMoodTint(residues: FeelingResidue[]): FeelingResidueTint {
    if (residues.length === 0) return { valence: 0, arousal: 0 };

    let totalValence = 0;
    let totalArousal = 0;
    let weightSum = 0;

    // Latest residues have more weight. Let's do a simple average for now.
    for (let i = 0; i < residues.length; i++) {
      const weight = 1; // can be adjusted based on recency
      const r = residues[i];
      if (r) {
        totalValence += r.valence * weight;
        totalArousal += r.arousal * weight;
        weightSum += weight;
      }
    }

    return {
      valence: totalValence / weightSum,
      arousal: totalArousal / weightSum,
    };
  },

  addResidue(
    residues: FeelingResidue[],
    valence: number,
    arousal: number,
    tick: number,
    eventId: string,
  ): void {
    residues.push({
      id: crypto.randomUUID(),
      tick,
      valence,
      arousal,
      sourceEventId: eventId,
    });
  },

  tickResidues(residues: FeelingResidue[], decayRate: number): void {
    // Reduce valence/arousal towards 0
    for (let i = residues.length - 1; i >= 0; i--) {
      const r = residues[i];
      if (r) {
        r.valence *= 1 - decayRate;
        r.arousal *= 1 - decayRate;

        if (Math.abs(r.valence) < 0.01 && Math.abs(r.arousal) < 0.01) {
          residues.splice(i, 1);
        }
      }
    }
  },
};
