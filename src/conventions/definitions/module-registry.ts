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

// ── Module raw parts imports ────────────────────────────────────────

import { createNaturalNtModule } from "./modules/natural-nt";
import { naturalNtLocal, createNaturalNtRuleDefs } from "./modules/natural-nt-rules";

import { createStaymanModule } from "./modules/stayman";
import { staymanLocal, createStaymanRuleDefs } from "./modules/stayman-rules";

import { createJacobyTransfersModule } from "./modules/jacoby-transfers";
import { jacobyTransfersLocal, jacobyTransfersRuleDefs } from "./modules/jacoby-transfers-rules";

import { createSmolenModule } from "./modules/smolen";
import { smolenLocal, smolenRuleDefs } from "./modules/smolen-rules";

import { createBergenModule } from "./modules/bergen";
import { bergenLocal, bergenRuleDefs } from "./modules/bergen/bergen-rules";

import { createDontModule } from "./modules/dont";
import { dontLocal, dontRuleDefs } from "./modules/dont/dont-rules";

import { createWeakTwosModule } from "./modules/weak-twos";
import { weakTwosLocal, weakTwosRuleDefs } from "./modules/weak-twos/weak-twos-rules";

// ── Factory type ────────────────────────────────────────────────────

/** A factory that produces a ConventionModule for a given SystemConfig. */
export type ModuleFactory = (sys: SystemConfig) => ConventionModule;

// ── Factory registry ────────────────────────────────────────────────

const MODULE_FACTORIES = new Map<string, ModuleFactory>([
  ["natural-nt", (sys) => {
    const parts = createNaturalNtModule(sys);
    return {
      moduleId: "natural-nt",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: naturalNtLocal,
      rules: createNaturalNtRuleDefs(sys),
    };
  }],
  ["stayman", (sys) => {
    const parts = createStaymanModule(sys);
    return {
      moduleId: "stayman",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: staymanLocal,
      rules: createStaymanRuleDefs(sys),
    };
  }],
  ["jacoby-transfers", (sys) => {
    const parts = createJacobyTransfersModule(sys);
    return {
      moduleId: "jacoby-transfers",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: jacobyTransfersLocal,
      rules: jacobyTransfersRuleDefs,
    };
  }],
  ["smolen", (sys) => {
    const parts = createSmolenModule(sys);
    return {
      moduleId: "smolen",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: smolenLocal,
      rules: smolenRuleDefs,
    };
  }],
  ["bergen", (sys) => {
    const parts = createBergenModule(sys);
    return {
      moduleId: "bergen",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: bergenLocal,
      rules: bergenRuleDefs,
    };
  }],
  ["dont", (sys) => {
    const parts = createDontModule(sys);
    return {
      moduleId: "dont",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: dontLocal,
      rules: dontRuleDefs,
    };
  }],
  ["weak-twos", (sys) => {
    const parts = createWeakTwosModule(sys);
    return {
      moduleId: "weak-twos",
      facts: parts.facts,
      explanationEntries: parts.explanationEntries,
      local: weakTwosLocal,
      rules: weakTwosRuleDefs,
    };
  }],
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
