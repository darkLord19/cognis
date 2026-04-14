import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Rule = {
  name: string;
  pattern: RegExp;
  include?: RegExp;
  exclude?: RegExp;
};

const QUALIA_PROCESSOR = join(process.cwd(), "server/agents/qualia-processor.ts");

if (!existsSync(QUALIA_PROCESSOR)) {
  console.log("veil-check skipped: qualia processor not found");
  process.exit(0);
}

const lines = readFileSync(QUALIA_PROCESSOR, "utf8").split(/\r?\n/);

const rules: Rule[] = [
  {
    name: "forbidden substrate terms",
    pattern: /(simulation|" AI|' AI|agent_id|coordinate|Forge|operator)/,
    exclude: /(\/\/|^\s*import\s|^\s*type\s|operatorEntityId|operatorMaterialId)/,
  },
  {
    name: "forbidden template terms",
    pattern: /(lightLevel|cycleHormone|tick|circadian|_id\b)/,
    include: /(QUALIA_TEMPLATES|pickTemplate|parts\.push|text\s*=)/,
  },
];

const violations: string[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i] ?? "";

  for (const rule of rules) {
    if (!rule.pattern.test(line)) {
      continue;
    }
    if (rule.include && !rule.include.test(line)) {
      continue;
    }
    if (rule.exclude?.test(line)) {
      continue;
    }

    violations.push(`${QUALIA_PROCESSOR}:${i + 1} (${rule.name}) ${line.trim()}`);
  }
}

if (violations.length > 0) {
  console.error("Veil check failed:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log("Veil check passed.");
