/**
 * Convention Module Registry — central lookup for all convention modules.
 *
 * Modules register here via factory functions parameterized by SystemConfig.
 * The registry supports both config-driven instantiation (preferred) and
 * backward-compatible default instantiation (deprecated, uses SAYC).
 */

import type { ConventionModule } from "../core/convention-module";
import type { SystemConfig } from "../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";

// ── Module factory imports ──────────────────────────────────────────

import { createNaturalNtModule } from "./modules/natural-nt";
import { createStaymanModule } from "./modules/stayman";
import { createJacobyTransfersModule } from "./modules/jacoby-transfers";
import { createSmolenModule } from "./modules/smolen";
import { createBergenModule } from "./modules/bergen";
import { createDontModule } from "./modules/dont";
import { createWeakTwosModule } from "./modules/weak-twos";

// ── Factory type ────────────────────────────────────────────────────

/** A factory that produces a ConventionModule for a given SystemConfig. */
export type ModuleFactory = (sys: SystemConfig) => ConventionModule;

// ── Factory registry ────────────────────────────────────────────────

const MODULE_FACTORIES = new Map<string, ModuleFactory>([
  ["natural-nt", (sys) => createNaturalNtModule(sys)],
  ["stayman", (sys) => createStaymanModule(sys)],
  ["jacoby-transfers", (sys) => createJacobyTransfersModule(sys)],
  ["smolen", (sys) => createSmolenModule(sys)],
  ["bergen", (sys) => createBergenModule(sys)],
  ["dont", (sys) => createDontModule(sys)],
  ["weak-twos", (sys) => createWeakTwosModule(sys)],
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

/** Get all registered module IDs. */
export function getModuleIds(): readonly string[] {
  return [...MODULE_FACTORIES.keys()];
}
