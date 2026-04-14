import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TOKENS = ["EAT", "DRINK", "FIND_FOOD", "FIND_WATER"] as const;
const TOKEN_REGEX = new RegExp(`\\b(${TOKENS.join("|")})\\b`);
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
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

test("runtime files do not contain legacy symbolic survival actions", () => {
  const root = process.cwd();
  const files = collectFiles(root);

  const violations: string[] = [];
  for (const file of files) {
    if (shouldAllow(file)) {
      continue;
    }

    const content = readFileSync(join(root, file), "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (TOKEN_REGEX.test(line)) {
        violations.push(`${file}:${index + 1} ${line.trim()}`);
      }
      TOKEN_REGEX.lastIndex = 0;
    });
  }

  expect(violations).toEqual([]);
});
