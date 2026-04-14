import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TOKENS = ["EAT", "DRINK", "FIND_FOOD", "FIND_WATER"] as const;
const TOKEN_REGEX = new RegExp(`\\b(${TOKENS.join("|")})\\b`, "g");

const SKIP_DIRS = new Set([
  ".git",
  ".vscode",
  "node_modules",
  "dist",
  "coverage",
  "tmp",
  ".next",
  ".turbo",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function shouldAllow(path: string): boolean {
  const normalized = normalize(path);
  return (
    normalized.startsWith("tests/") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith(".codex/") ||
    normalized === "shared/constants.ts" ||
    normalized === "scripts/no-symbolic-actions.ts"
  );
}

type Violation = {
  path: string;
  line: number;
  token: string;
  text: string;
};

function collectFiles(root: string, relative = ""): string[] {
  const dir = join(root, relative);
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const rel = normalize(relative ? join(relative, entry.name) : entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...collectFiles(root, rel));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!SCAN_EXTENSIONS.has(extension(entry.name))) {
      continue;
    }

    files.push(rel);
  }

  return files;
}

function scanFile(root: string, relPath: string): Violation[] {
  if (shouldAllow(relPath)) {
    return [];
  }

  const absolutePath = join(root, relPath);
  if (!statSync(absolutePath).isFile()) {
    return [];
  }

  const content = readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  const violations: Violation[] = [];

  lines.forEach((line, index) => {
    const matches = line.matchAll(TOKEN_REGEX);
    for (const match of matches) {
      const token = match[1];
      if (!token) continue;
      violations.push({
        path: relPath,
        line: index + 1,
        token,
        text: line.trim(),
      });
    }
  });

  return violations;
}

const root = process.cwd();
const files = collectFiles(root);
const violations = files.flatMap((file) => scanFile(root, file));

if (violations.length > 0) {
  console.error(
    "No-symbolic-actions check failed. Found forbidden symbolic actions in runtime files:",
  );
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line} [${violation.token}] ${violation.text}`);
  }
  process.exit(1);
}

console.log("No-symbolic-actions check passed.");
