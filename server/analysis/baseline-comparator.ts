export type BaselineInterpretation =
  | "confabulation"
  | "genuine_emergence"
  | "physical_substrate"
  | "semantic_dependent";

// biome-ignore lint/complexity/noStaticOnlyClass: PRD requires a class
export class BaselineComparator {
  public static compareFindings(
    findingA: boolean,
    findingB: boolean,
    findingC: boolean,
  ): BaselineInterpretation {
    if (findingA && findingB) return "physical_substrate";
    if (findingA && !findingB && findingC) return "genuine_emergence";
    if (findingA && !findingB && !findingC) return "semantic_dependent";
    return "confabulation";
  }

  public static generateReport(phenomenonName: string): string {
    return `Analysis of ${phenomenonName} complete across all baseline configurations.`;
  }
}
