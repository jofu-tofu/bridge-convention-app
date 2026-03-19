// ── Module Interference Detector ────────────────────────────────────
//
// Static analysis to detect modules that claim overlapping auction
// prefix space.  Two modules sharing a prefix at the same dispatch
// point means one shadows the other (module order determines which).
//
// This is a separate risk from (state, surface) coverage — interference
// bugs live in the composition layer, not the FSM layer.

import type { ConventionModule } from "./module-types";
import type { MachineTransition, TransitionMatch } from "../runtime/machine-types";
import { matchToCall, callToString } from "../runtime/machine-enumeration";

// ── Types ───────────────────────────────────────────────────────────

/** A detected prefix overlap between modules. */
export interface ModuleInterference {
  /** Auction prefix string (e.g., "2C", "3H"). */
  readonly auctionPrefix: string;
  /** Module IDs that both claim this prefix. */
  readonly conflictingModules: readonly string[];
  /** Where the conflict occurs: "entry" (dispatch point) or "hook" (injected). */
  readonly location: "entry" | "hook";
  /** Target state at which the conflict occurs (for hooks). */
  readonly targetStateId?: string;
  /** "error" = hard conflict (same bid), "warning" = guarded/ambiguous. */
  readonly severity: "error" | "warning";
}

/** Full interference analysis report for a module set. */
export interface InterferenceReport {
  /** Module IDs analyzed. */
  readonly moduleIds: readonly string[];
  /** Detected interferences. */
  readonly interferences: readonly ModuleInterference[];
  /** True if any error-severity interferences were found. */
  readonly hasConflicts: boolean;
  /** Prefix → module ownership map (for debugging). */
  readonly prefixOwnership: ReadonlyMap<string, readonly string[]>;
}

// ── Utilities ───────────────────────────────────────────────────────

/** Extract the auction prefix string from a transition match, if statically resolvable. */
function transitionToPrefix(match: TransitionMatch): string | null {
  const call = matchToCall(match);
  return call ? callToString(call) : null;
}

/** Extract prefixes claimed by a module's entry transitions. */
function getEntryPrefixes(mod: ConventionModule): Map<string, MachineTransition> {
  const prefixes = new Map<string, MachineTransition>();
  for (const t of mod.entryTransitions) {
    const prefix = transitionToPrefix(t.match);
    if (prefix) {
      prefixes.set(prefix, t);
    }
  }
  return prefixes;
}

/** Extract (targetStateId, prefix) pairs from hook transitions. */
function getHookPrefixes(
  mod: ConventionModule,
): Map<string, Map<string, MachineTransition>> {
  const hooks = new Map<string, Map<string, MachineTransition>>();
  for (const hook of mod.hookTransitions ?? []) {
    let prefixMap = hooks.get(hook.targetStateId);
    if (!prefixMap) {
      prefixMap = new Map();
      hooks.set(hook.targetStateId, prefixMap);
    }
    for (const t of hook.transitions) {
      const prefix = transitionToPrefix(t.match);
      if (prefix) {
        prefixMap.set(prefix, t);
      }
    }
  }
  return hooks;
}

// ── Core Detection ──────────────────────────────────────────────────

/**
 * Detect prefix-level interference between modules.
 *
 * Checks two conflict types:
 * 1. Entry conflicts: two modules claim the same bid at the dispatch point.
 * 2. Hook conflicts: two modules inject the same bid at the same target state.
 *
 * Guarded transitions (those with a `guard` function) produce warnings
 * instead of errors, since runtime guards may disambiguate.
 */
export function detectModuleInterference(
  modules: readonly ConventionModule[],
): InterferenceReport {
  const interferences: ModuleInterference[] = [];

  // Global prefix ownership map (for reporting)
  const prefixOwnership = new Map<string, string[]>();

  // ── Entry transition conflicts ────────────────────────────────────
  const entryPrefixMap = new Map<string, { moduleId: string; transition: MachineTransition }[]>();
  for (const mod of modules) {
    const prefixes = getEntryPrefixes(mod);
    for (const [prefix, transition] of prefixes) {
      let owners = entryPrefixMap.get(prefix);
      if (!owners) {
        owners = [];
        entryPrefixMap.set(prefix, owners);
      }
      owners.push({ moduleId: mod.moduleId, transition });

      // Track global ownership
      let globalOwners = prefixOwnership.get(prefix);
      if (!globalOwners) {
        globalOwners = [];
        prefixOwnership.set(prefix, globalOwners);
      }
      if (!globalOwners.includes(mod.moduleId)) {
        globalOwners.push(mod.moduleId);
      }
    }
  }

  for (const [prefix, owners] of entryPrefixMap) {
    if (owners.length > 1) {
      const hasGuard = owners.some((o) => o.transition.guard !== undefined);
      interferences.push({
        auctionPrefix: prefix,
        conflictingModules: owners.map((o) => o.moduleId),
        location: "entry",
        severity: hasGuard ? "warning" : "error",
      });
    }
  }

  // ── Hook transition conflicts ─────────────────────────────────────
  // Group by target state, then detect prefix overlaps within each state
  const hooksByState = new Map<string, { moduleId: string; prefix: string; transition: MachineTransition }[]>();

  for (const mod of modules) {
    const hooks = getHookPrefixes(mod);
    for (const [targetStateId, prefixMap] of hooks) {
      let stateHooks = hooksByState.get(targetStateId);
      if (!stateHooks) {
        stateHooks = [];
        hooksByState.set(targetStateId, stateHooks);
      }
      for (const [prefix, transition] of prefixMap) {
        stateHooks.push({ moduleId: mod.moduleId, prefix, transition });
      }
    }
  }

  for (const [targetStateId, hooks] of hooksByState) {
    // Group hooks by prefix within this state
    const byPrefix = new Map<string, typeof hooks>();
    for (const hook of hooks) {
      let group = byPrefix.get(hook.prefix);
      if (!group) {
        group = [];
        byPrefix.set(hook.prefix, group);
      }
      group.push(hook);
    }

    for (const [prefix, group] of byPrefix) {
      if (group.length > 1) {
        const hasGuard = group.some((g) => g.transition.guard !== undefined);
        interferences.push({
          auctionPrefix: prefix,
          conflictingModules: group.map((g) => g.moduleId),
          location: "hook",
          targetStateId,
          severity: hasGuard ? "warning" : "error",
        });
      }
    }
  }

  return {
    moduleIds: modules.map((m) => m.moduleId),
    interferences,
    hasConflicts: interferences.some((i) => i.severity === "error"),
    prefixOwnership,
  };
}
