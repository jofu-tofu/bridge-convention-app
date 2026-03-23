/**
 * Convention Module Registry — central lookup for all convention modules.
 *
 * Modules register here via factory functions parameterized by SystemConfig.
 * The registry is the ONLY place ConventionModule is assembled — module files
 * export raw parts (surfaces, facts, explanations, local FSM, rules), and
 * the registry combines them into the unified type.
 */

import type { ConventionModule } from "../core/convention-module";
import type { SystemConfig } from "../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";

// ── Declaration imports (facts + explanations) ─────────────────────

import { createNaturalNtDeclarations, naturalNtLocal, createNaturalNtStates } from "./modules/natural-nt";
import { createStaymanDeclarations, staymanLocal, createStaymanStates } from "./modules/stayman";
import { createJacobyTransfersDeclarations, jacobyTransfersLocal, createJacobyTransfersStates } from "./modules/jacoby-transfers";
import { createSmolenDeclarations, smolenLocal, createSmolenStates } from "./modules/smolen";
import { createBergenModule, bergenLocal, createBergenStates } from "./modules/bergen";
import { createDontModule, dontLocal, createDontStates } from "./modules/dont";
import { createWeakTwosModule, weakTwosLocal, createWeakTwosStates } from "./modules/weak-twos";

// ── Factory type ────────────────────────────────────────────────────

/** A factory that produces a ConventionModule for a given SystemConfig. */
export type ModuleFactory = (sys: SystemConfig) => ConventionModule;

// ── Factory registry ────────────────────────────────────────────────

const MODULE_FACTORIES = new Map<string, ModuleFactory>([
  ["natural-nt", (sys) => ({
    moduleId: "natural-nt",
    ...createNaturalNtDeclarations(sys),
    local: naturalNtLocal,

    states: createNaturalNtStates(sys),
  })],
  ["stayman", (sys) => ({
    moduleId: "stayman",
    ...createStaymanDeclarations(sys),
    local: staymanLocal,

    states: createStaymanStates(sys),
  })],
  ["jacoby-transfers", (sys) => ({
    moduleId: "jacoby-transfers",
    ...createJacobyTransfersDeclarations(sys),
    local: jacobyTransfersLocal,

    states: createJacobyTransfersStates(sys),
  })],
  ["smolen", (sys) => ({
    moduleId: "smolen",
    ...createSmolenDeclarations(sys),
    local: smolenLocal,

    states: createSmolenStates(sys),
  })],
  ["bergen", (sys) => ({
    moduleId: "bergen",
    ...createBergenModule(sys),
    local: bergenLocal,

    states: createBergenStates(sys),
  })],
  ["dont", (sys) => ({
    moduleId: "dont",
    ...createDontModule(sys),
    local: dontLocal,

    states: createDontStates(),
  })],
  ["weak-twos", (sys) => ({
    moduleId: "weak-twos",
    ...createWeakTwosModule(sys),
    local: weakTwosLocal,

    states: createWeakTwosStates(),
  })],
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
