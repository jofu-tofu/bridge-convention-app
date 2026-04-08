/**
 * Single source of truth for module categorization, merging, and grouping.
 * Pure functions — no store or Svelte imports.
 */

import type { ModuleCatalogEntry } from "../../service";
import type { UserModule } from "../../service/session-types";

/** Maps system module IDs to their display category. */
export const MODULE_CATEGORIES: Record<string, string> = {
  "natural-bids": "Opening Bids",
  "strong-2c": "Opening Bids",
  "stayman": "Notrump Responses",
  "stayman-garbage": "Notrump Responses",
  "jacoby-transfers": "Notrump Responses",
  "jacoby-4way": "Notrump Responses",
  "smolen": "Notrump Responses",
  "bergen": "Major Raises",
  "weak-twos": "Weak Bids",
  "dont": "Competitive",
  "michaels-unusual": "Competitive",
  "blackwood": "Slam",
};

/** Maps ModuleCategory enum values to display names. */
export const CATEGORY_DISPLAY: Record<string, string> = {
  "opening-bids": "Opening Bids",
  "notrump-responses": "Notrump Responses",
  "major-raises": "Major Raises",
  "weak-bids": "Weak Bids",
  "competitive": "Competitive",
  "slam": "Slam",
  "custom": "Custom",
};

export interface CatalogModule {
  moduleId: string;
  displayName: string;
  isCustom: boolean;
  forkedFromId: string | null;
  forkedFromVersion: number | null;
  category: string;
}

/**
 * Merges system modules + user modules into a unified list with category assigned.
 *
 * Category resolution:
 *   System modules: MODULE_CATEGORIES[moduleId] ?? "Other"
 *   User modules with forkedFrom: MODULE_CATEGORIES[forkedFromId] ?? "Other"
 *   User modules without forkedFrom: CATEGORY_DISPLAY[metadata.category] ?? "Other"
 */
export function mergeModules(
  systemModules: ModuleCatalogEntry[],
  userModules: UserModule[],
): CatalogModule[] {
  const result: CatalogModule[] = [];

  for (const mod of systemModules) {
    result.push({
      moduleId: mod.moduleId,
      displayName: mod.displayName,
      isCustom: false,
      forkedFromId: null,
      forkedFromVersion: null,
      category: MODULE_CATEGORIES[mod.moduleId] ?? "Other",
    });
  }

  for (const um of userModules) {
    const sourceId = um.metadata.forkedFrom?.moduleId ?? null;
    let category: string;
    if (sourceId) {
      category = MODULE_CATEGORIES[sourceId] ?? "Other";
    } else {
      category = CATEGORY_DISPLAY[um.metadata.category] ?? "Other";
    }

    result.push({
      moduleId: um.metadata.moduleId,
      displayName: um.metadata.displayName,
      isCustom: true,
      forkedFromId: sourceId,
      forkedFromVersion: um.metadata.forkedFrom?.fixtureVersion ?? null,
      category,
    });
  }

  return result;
}

/**
 * Groups a flat list of CatalogModules by category.
 * Ordering: categories from MODULE_CATEGORIES insertion order first,
 * then "Custom", then "Other" last.
 */
export function groupByCategory(modules: CatalogModule[]): Map<string, CatalogModule[]> {
  // Collect all modules per category
  const raw = new Map<string, CatalogModule[]>();
  for (const mod of modules) {
    const list = raw.get(mod.category);
    if (list) {
      list.push(mod);
    } else {
      raw.set(mod.category, [mod]);
    }
  }

  // Build ordered result: known categories first (in MODULE_CATEGORIES insertion order),
  // then "Custom", then "Other"
  const knownOrder = [...new Set(Object.values(MODULE_CATEGORIES))];
  const result = new Map<string, CatalogModule[]>();

  for (const cat of knownOrder) {
    const list = raw.get(cat);
    if (list) result.set(cat, list);
  }

  const custom = raw.get("Custom");
  if (custom) result.set("Custom", custom);

  const other = raw.get("Other");
  if (other) result.set("Other", other);

  // Any remaining categories not in the known set
  for (const [cat, list] of raw) {
    if (!result.has(cat)) result.set(cat, list);
  }

  return result;
}

/** Case-insensitive substring match on displayName. */
export function filterModules(modules: CatalogModule[], query: string): CatalogModule[] {
  if (!query) return modules;
  const q = query.toLowerCase();
  return modules.filter((m) => m.displayName.toLowerCase().includes(q));
}
