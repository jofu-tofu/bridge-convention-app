/**
 * Export convention bundles as JSON fixtures for Rust round-trip testing.
 *
 * Imports all 6 bundles via resolveBundle(), strips function fields,
 * and writes to src-tauri/crates/bridge-conventions/fixtures/{bundle-id}.json.
 *
 * Usage: npx tsx scripts/export-conventions.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getBundleInput, resolveBundle } from "../src/conventions/definitions/system-registry";
import { SAYC_SYSTEM_CONFIG } from "../src/conventions/definitions/system-config";
import type { ConventionBundle } from "../src/conventions/core/bundle/bundle-types";
import type { ConventionModule } from "../src/conventions/core/convention-module";
import type { FactCatalogExtension } from "../src/conventions/core/fact-catalog";

const BUNDLE_IDS = [
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "bergen-bundle",
  "weak-twos-bundle",
  "dont-bundle",
];

const FIXTURES_DIR = join(
  __dirname,
  "../src-tauri/crates/bridge-conventions/fixtures",
);

/**
 * Strip function fields from a FactCatalogExtension, keeping only definitions.
 */
function stripFacts(facts: FactCatalogExtension): { definitions: unknown[] } {
  return {
    definitions: [...facts.definitions],
  };
}

/**
 * Strip function fields from a ConventionModule.
 */
function stripModule(mod: ConventionModule): Record<string, unknown> {
  const { facts, ...rest } = mod as Record<string, unknown> & {
    facts: FactCatalogExtension;
  };
  return {
    ...rest,
    facts: stripFacts(facts),
  };
}

/**
 * Strip function fields from a ConventionBundle.
 */
function stripBundle(
  bundle: ConventionBundle,
): Record<string, unknown> {
  const plain = { ...bundle } as Record<string, unknown>;

  // Strip function field
  delete plain.defaultAuction;

  // Strip function fields from each module's facts
  plain.modules = (bundle.modules as ConventionModule[]).map(stripModule);

  return plain;
}

function main(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  let exported = 0;
  for (const id of BUNDLE_IDS) {
    const input = getBundleInput(id);
    if (!input) {
      console.error(`Bundle not found: ${id}`);
      process.exit(1);
    }

    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    const stripped = stripBundle(bundle);
    const json = JSON.stringify(stripped, null, 2);

    const outPath = join(FIXTURES_DIR, `${id}.json`);
    writeFileSync(outPath, json + "\n", "utf-8");
    exported++;
    console.log(`Exported: ${outPath} (${(json.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`\nDone. Exported ${exported} bundles.`);
}

main();
