/**
 * Convention Module Registry — central lookup for all convention modules.
 *
 * Modules register here and can be looked up by ID. The runtime uses this
 * to resolve module references from system profiles.
 */

import type { ConventionModule, ModuleProvider } from "../core/convention-module";

// ── Module imports ──────────────────────────────────────────────────

import { staymanModule } from "./modules/stayman";
import { jacobyTransfersModule } from "./modules/jacoby-transfers";
import { naturalNtModule } from "./modules/natural-nt";
import { smolenModule } from "./modules/smolen";
import { bergenModule } from "./modules/bergen";
import { dontModule } from "./modules/dont";
import { weakTwosModule } from "./modules/weak-twos";

// ── Registry ────────────────────────────────────────────────────────

const ALL_MODULES: ConventionModule[] = [
  staymanModule,
  jacobyTransfersModule,
  naturalNtModule,
  smolenModule,
  bergenModule,
  dontModule,
  weakTwosModule,
];

const MODULE_REGISTRY = new Map<string, ConventionModule>(
  ALL_MODULES.map((m) => [m.moduleId, m]),
);

/** Look up a module by ID. Returns undefined if not found. */
export function getModule(moduleId: string): ConventionModule | undefined {
  return MODULE_REGISTRY.get(moduleId);
}

/** Get all registered modules. */
export function getAllModules(): readonly ConventionModule[] {
  return [...MODULE_REGISTRY.values()];
}

/** Get modules by a list of IDs. Throws if any ID is not found. */
export function getModules(moduleIds: readonly string[]): readonly ConventionModule[] {
  return moduleIds.map((id) => {
    const mod = MODULE_REGISTRY.get(id);
    if (!mod) throw new Error(`Unknown module: ${id}`);
    return mod;
  });
}
