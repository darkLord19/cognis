const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bsimulation\b/gi,
  /\bai\b/gi,
  /\bcode\b/gi,
  /\bdata\b/gi,
  /\bcoordinates?\b/gi,
  /\bmaterialtype\b/gi,
  /\bvoxeltype\b/gi,
  /\b[a-z]+_id\b/gi,
  /\btick\b/gi,
];

export function enforceQualiaVeil(input: string): string {
  let value = input;

  for (const pattern of FORBIDDEN_PATTERNS) {
    value = value.replace(pattern, "veil");
  }

  return value;
}
