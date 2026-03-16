/**
 * Registry merger utilities for the profile compiler.
 *
 * Merges fact catalogs, explanation entries, pedagogical relations,
 * and alternative groups from module packages.
 */

import type { FactCatalog, FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import { createFactCatalog } from "../../../core/contracts/fact-catalog";
import type { ExplanationCatalogIR, ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import { createExplanationCatalog } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { AlternativeGroup } from "../../../core/contracts/tree-evaluation";
import type { ModulePackage } from "../modules";
import { createSharedFactCatalog } from "../pipeline/fact-evaluator";

/**
 * Merge fact catalog extensions onto the shared base catalog.
 */
export function mergeFactCatalogs(
  extensions: readonly FactCatalogExtension[],
): FactCatalog {
  const base = createSharedFactCatalog();
  if (extensions.length === 0) return base;
  return createFactCatalog(base, ...extensions);
}

/**
 * Merge explanation entries into a single ExplanationCatalogIR.
 */
export function mergeExplanationEntries(
  entries: readonly ExplanationEntry[],
): ExplanationCatalogIR {
  if (entries.length === 0) {
    return { version: "1.0.0", entries: [] };
  }
  return createExplanationCatalog([...entries]);
}

/**
 * Collect pedagogical relations from all module packages.
 */
export function mergePedagogicalRelations(
  packages: readonly ModulePackage[],
): readonly PedagogicalRelation[] {
  return packages.flatMap(
    (pkg) => pkg.exports.pedagogicalRelations ?? [],
  );
}

/**
 * Collect alternative groups from all module packages.
 * Currently returns empty — packages don't yet carry alternatives.
 */
export function mergeAlternativeGroups(
  _packages: readonly ModulePackage[],
): readonly AlternativeGroup[] {
  return [];
}
