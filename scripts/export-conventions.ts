/**
 * Export convention bundles as JSON fixtures for Rust round-trip testing
 * and registry data.
 *
 * Exports:
 * 1. Full resolved bundles → fixtures/{bundle-id}.json (existing)
 * 2. Per-module JSON → fixtures/modules/{module-id}.json (for Rust registry)
 * 3. Bundle-input manifests → fixtures/bundle-manifests.json (for Rust registry)
 *
 * Usage: npx tsx scripts/export-conventions.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getBundleInput, resolveBundle, listBundleInputs } from "../src/conventions/definitions/system-registry";
import { SAYC_SYSTEM_CONFIG } from "../src/conventions/definitions/system-config";
import { getModule, getAllModules } from "../src/conventions/definitions/module-registry";
import type { ConventionBundle, BundleInput } from "../src/conventions/core/bundle/bundle-types";
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

const MODULES_DIR = join(FIXTURES_DIR, "modules");

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

/**
 * Strip BundleInput to plain data (remove any non-serializable fields).
 */
function stripBundleInput(input: BundleInput): Record<string, unknown> {
  // BundleInput is already plain data, but ensure clean serialization
  return {
    id: input.id,
    name: input.name,
    memberIds: input.memberIds,
    ...(input.internal != null && { internal: input.internal }),
    ...(input.systemProfile != null && { systemProfile: input.systemProfile }),
    ...(input.declaredCapabilities != null && { declaredCapabilities: input.declaredCapabilities }),
    category: input.category,
    description: input.description,
    ...(input.teaching != null && { teaching: input.teaching }),
  };
}

function exportBundles(): number {
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
    console.log(`Exported bundle: ${outPath} (${(json.length / 1024).toFixed(1)} KB)`);
  }
  return exported;
}

function exportModules(): number {
  mkdirSync(MODULES_DIR, { recursive: true });

  const modules = getAllModules(SAYC_SYSTEM_CONFIG);
  let exported = 0;
  for (const mod of modules) {
    const stripped = stripModule(mod);
    const json = JSON.stringify(stripped, null, 2);

    const outPath = join(MODULES_DIR, `${mod.moduleId}.json`);
    writeFileSync(outPath, json + "\n", "utf-8");
    exported++;
    console.log(`Exported module: ${outPath} (${(json.length / 1024).toFixed(1)} KB)`);
  }
  return exported;
}

function exportBundleManifests(): void {
  const inputs = listBundleInputs();
  const manifests = inputs.map(stripBundleInput);
  const json = JSON.stringify(manifests, null, 2);

  const outPath = join(FIXTURES_DIR, "bundle-manifests.json");
  writeFileSync(outPath, json + "\n", "utf-8");
  console.log(`Exported bundle manifests: ${outPath} (${(json.length / 1024).toFixed(1)} KB)`);
}

function main(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const bundleCount = exportBundles();
  const moduleCount = exportModules();
  exportBundleManifests();

  console.log(`\nDone. Exported ${bundleCount} bundles, ${moduleCount} modules, 1 manifest.`);
}

main();
