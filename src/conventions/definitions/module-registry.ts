/**
 * Convention Module Registry — central lookup for all convention modules.
 *
 * Each module folder exports a self-contained `moduleFactory` that produces
 * a complete ConventionModule for a given SystemConfig. The registry simply
 * collects these factories — no per-module assembly logic needed here.
 */

import type { ConventionModule } from "../core/convention-module";
import type { SystemConfig } from "./system-config";
import { SAYC_SYSTEM_CONFIG } from "./system-config";

// ── Module factory imports ──────────────────────────────────────────
// Each module exports a standardized `moduleFactory: ModuleFactory`.

import { moduleFactory as naturalNt } from "./modules/natural-nt";
import { moduleFactory as stayman } from "./modules/stayman";
import { moduleFactory as jacobyTransfers } from "./modules/jacoby-transfers";
import { moduleFactory as smolen } from "./modules/smolen";
import { moduleFactory as bergen } from "./modules/bergen";
import { moduleFactory as dont } from "./modules/dont";
import { moduleFactory as weakTwos } from "./modules/weak-twos";
import { moduleFactory as blackwood } from "./modules/blackwood";

// ── Factory type ────────────────────────────────────────────────────

/** A factory that produces a ConventionModule for a given SystemConfig. */
type ModuleFactory = (sys: SystemConfig) => ConventionModule;

// ── Factory registry ────────────────────────────────────────────────

const MODULE_FACTORIES = new Map<string, ModuleFactory>([
  ["natural-bids", naturalNt],
  ["stayman", stayman],
  ["jacoby-transfers", jacobyTransfers],
  ["smolen", smolen],
  ["bergen", bergen],
  ["dont", dont],
  ["weak-twos", weakTwos],
  ["blackwood", blackwood],
]);

// ── Instance cache ──────────────────────────────────────────────────

/** Cache keyed by `${moduleId}:${systemId}` to avoid re-instantiating. */
const instanceCache = new Map<string, ConventionModule>();

function cacheKey(moduleId: string, sys: SystemConfig): string {
  return `${moduleId}:${sys.systemId}`;
}

// ── Public API ──────────────────────────────────────────────────────

/** Look up a module by ID, instantiated for the given system config.
 *  Returns undefined if the module ID is not registered. */
export function getModule(moduleId: string, sys: SystemConfig = SAYC_SYSTEM_CONFIG): ConventionModule | undefined {
  const factory = MODULE_FACTORIES.get(moduleId);
  if (!factory) return undefined;

  const key = cacheKey(moduleId, sys);
  let mod = instanceCache.get(key);
  if (!mod) {
    mod = factory(sys);
    instanceCache.set(key, mod);
  }
  return mod;
}

/** Get all registered modules for a given system config. */
export function getAllModules(sys: SystemConfig = SAYC_SYSTEM_CONFIG): readonly ConventionModule[] {
  return [...MODULE_FACTORIES.keys()].map((id) => getModule(id, sys)!);
}

/** Get modules by a list of IDs for a given system config.
 *  Throws if any ID is not found. */
export function getModules(moduleIds: readonly string[], sys: SystemConfig = SAYC_SYSTEM_CONFIG): readonly ConventionModule[] {
  return moduleIds.map((id) => {
    const mod = getModule(id, sys);
    if (!mod) throw new Error(`Unknown module: ${id}`);
    return mod;
  });
}


