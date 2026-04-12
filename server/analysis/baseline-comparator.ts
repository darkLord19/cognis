import type { BaselineInterpretation } from "../../shared/types";

/**
 * PRD Section 8.1 — Triple Baseline Interpretation Matrix:
 *
 * | A (full) | B (pure_reflex) | C (masked_labels) | Interpretation         |
 * |----------|-----------------|-------------------|------------------------|
 * | Yes      | No              | No                | confabulation          |
 * | Yes      | No              | Yes               | genuine_emergence      |
 * | Yes      | Yes             | Yes               | physical_substrate     |
 * | Yes      | Yes             | No                | semantic_dependent     |
 * | No       | *               | *                 | confabulation          |
 */
export const BaselineComparator = {
  compareFindings(findingA: boolean, findingB: boolean, findingC: boolean): BaselineInterpretation {
    if (!findingA) return "confabulation";
    if (findingA && findingB && findingC) return "physical_substrate";
    if (findingA && findingB && !findingC) return "semantic_dependent";
    if (findingA && !findingB && findingC) return "genuine_emergence";
    // findingA && !findingB && !findingC
    return "confabulation";
  },

  generateReport(phenomenonName: string): string {
    return `Analysis of ${phenomenonName} complete across all baseline configurations.`;
  },
};
