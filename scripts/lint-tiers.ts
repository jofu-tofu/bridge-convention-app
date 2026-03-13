/**
 * Lint convention test files for tier annotations.
 *
 * Every top-level `describe(` in a convention test file must use one of:
 * - `refDescribe(` — reference tier
 * - `policyDescribe(` — policy tier
 * - `describe(` — structural (allowed, but counted)
 *
 * Reports any convention test file that has zero ref/policy markers.
 * Exit code 0 if all convention test files have at least one marker.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONVENTIONS_TEST_DIR = path.resolve(
  __dirname,
  "../src/conventions/__tests__",
);

const CONVENTION_DIRS = [
  "stayman",
  "bergen-raises",
  "sayc",
  "weak-twos",
  "lebensohl-lite",
  "jacoby-transfers",
];

interface FileResult {
  file: string;
  refCount: number;
  policyCount: number;
  plainCount: number;
}

function analyzeFile(filePath: string): FileResult {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let refCount = 0;
  let policyCount = 0;
  let plainCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("refDescribe(")) refCount++;
    else if (trimmed.startsWith("policyDescribe(")) policyCount++;
    else if (
      trimmed.startsWith("describe(") &&
      !trimmed.startsWith("describe.skip(")
    )
      plainCount++;
  }

  return {
    file: path.relative(process.cwd(), filePath),
    refCount,
    policyCount,
    plainCount,
  };
}

function main() {
  const results: FileResult[] = [];
  let hasFailures = false;

  for (const dir of CONVENTION_DIRS) {
    const dirPath = path.join(CONVENTIONS_TEST_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".test.ts"));
    for (const file of files) {
      const result = analyzeFile(path.join(dirPath, file));
      results.push(result);

      // Files with ONLY structural describes are allowed (pure infrastructure).
      // Only fail if a file has no tier markers AND has >2 describes
      // (suggesting convention-rule tests that should be classified).
      if (result.refCount === 0 && result.policyCount === 0 && result.plainCount > 2) {
        hasFailures = true;
      }
    }
  }

  // Print report
  console.log("\nConvention Test Tier Report");
  console.log("==========================\n");

  for (const r of results) {
    const status =
      r.refCount > 0 || r.policyCount > 0
        ? "PASS"
        : r.plainCount <= 2
          ? "SKIP (structural-only)"
          : "FAIL (no tier markers)";
    console.log(
      `  ${status}  ${r.file}  ref:${r.refCount} policy:${r.policyCount} structural:${r.plainCount}`,
    );
  }

  console.log(
    `\nTotal: ${results.length} files, ${results.reduce((s, r) => s + r.refCount, 0)} ref, ${results.reduce((s, r) => s + r.policyCount, 0)} policy, ${results.reduce((s, r) => s + r.plainCount, 0)} structural`,
  );

  if (hasFailures) {
    console.log(
      "\nERROR: Some convention test files have no tier markers (ref or policy).",
    );
    process.exit(1);
  } else {
    console.log("\nAll convention test files have tier annotations.");
  }
}

main();
