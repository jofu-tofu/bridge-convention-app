/**
 * Types and builder functions for CreationPickerDialog.
 * Pure functions — no store or Svelte imports.
 */

import type { ModuleCatalogEntry } from "../../service";
import { AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../../service";
import { mergeModules, groupByCategory } from "./module-catalog";

export interface PickerItem {
  id: string;
  label: string;
  description?: string;
  detail?: string;
  /** When true, the item renders greyed-out and non-interactive with an upgrade link. */
  locked?: boolean;
}

export interface PickerCategory {
  name: string;
  items: PickerItem[];
}

export function buildSystemPickerCategories(): PickerCategory[] {
  return [
    {
      name: "Preset Systems",
      items: AVAILABLE_BASE_SYSTEMS.map((sys) => {
        const config = getSystemConfig(sys.id);
        return {
          id: sys.id,
          label: sys.label,
          description: sys.shortLabel,
          detail: `${config.ntOpening.minHcp}-${config.ntOpening.maxHcp} NT · ${config.openingRequirements.majorSuitMinLength}-card Majors`,
        };
      }),
    },
  ];
}

export function buildConventionPickerCategories(
  modules: ModuleCatalogEntry[],
): PickerCategory[] {
  const catalogModules = mergeModules(modules, []);
  const grouped = groupByCategory(catalogModules);
  const result: PickerCategory[] = [];
  for (const [categoryName, mods] of grouped) {
    result.push({
      name: categoryName,
      items: mods.map((m) => ({
        id: m.moduleId,
        label: m.displayName,
      })),
    });
  }
  return result;
}
