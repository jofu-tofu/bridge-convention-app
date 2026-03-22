/**
 * Rule enumeration — walks ConventionModule[].states[].surfaces[] to produce RuleAtoms.
 *
 * Replaces the old FSM-based BFS coverage enumeration
 * (`coverage-enumeration.ts`) which walked state graphs.
 *
 * Atom identity: `moduleId/meaningId`. When the same meaningId appears
 * in multiple state entries (reachable under different phase guards), one atom
 * is emitted with all unique guard combinations in `allActivationPaths`.
 */

import type { Call } from "../../engine/types";
import type { ConventionModule } from "../core/convention-module";
import type { TurnRole } from "../core/rule-module";

// ── Types ───────────────────────────────────────────────────────────

/** One testable convention atom derived from rule module claims. */
export interface RuleAtom {
  readonly moduleId: string;
  readonly meaningId: string;
  readonly meaningLabel: string;
  readonly encoding: Call;
  /** Phase guard from the first rule occurrence. */
  readonly primaryPhaseGuard: string | readonly string[] | undefined;
  /** Turn guard from the first rule occurrence. */
  readonly turnGuard: TurnRole | undefined;
  /** All unique guard combinations for this meaning (for coverage diagnostics). */
  readonly allActivationPaths: readonly {
    readonly phaseGuards: string | readonly string[] | undefined;
    readonly turnGuard: TurnRole | undefined;
  }[];
}

/** Coverage manifest derived from rule modules. */
export interface RuleCoverageManifest {
  readonly systemId: string;
  readonly totalModules: number;
  readonly totalAtoms: number;
  readonly atoms: readonly RuleAtom[];
  /** Atoms grouped by module for display. */
  readonly atomsByModule: ReadonlyMap<string, readonly RuleAtom[]>;
}

// ── Enumeration ─────────────────────────────────────────────────────

/**
 * Enumerate all atoms from rule modules.
 *
 * Deduplication: one atom per unique `meaningId` per module.
 * Traversal: modules in array order, rules in array order within module.
 */
export function enumerateRuleAtoms(
  modules: readonly ConventionModule[],
): readonly RuleAtom[] {
  const atoms: RuleAtom[] = [];

  for (const mod of modules) {
    // Track seen meaningIds within this module for deduplication
    const seen = new Map<string, {
      atom: RuleAtom;
      paths: { phaseGuards: string | readonly string[] | undefined; turnGuard: TurnRole | undefined }[];
    }>();

    // Iterate state entries
    for (const state of (mod.states ?? [])) {
      for (const surface of state.surfaces) {
        const path = {
          phaseGuards: state.phase,
          turnGuard: state.turn,
        };

        const existing = seen.get(surface.meaningId);
        if (existing) {
          const isDuplicate = existing.paths.some(
            (p) => pathsEqual(p, path),
          );
          if (!isDuplicate) {
            existing.paths.push(path);
          }
        } else {
          const entry = {
            atom: {
              moduleId: mod.moduleId,
              meaningId: surface.meaningId,
              meaningLabel: surface.teachingLabel,
              encoding: surface.encoding.defaultCall,
              primaryPhaseGuard: state.phase,
              turnGuard: state.turn,
              allActivationPaths: [], // filled below
            },
            paths: [path],
          };
          seen.set(surface.meaningId, entry);
        }
      }
    }

    // Finalize atoms with all activation paths
    for (const { atom, paths } of seen.values()) {
      atoms.push({
        ...atom,
        allActivationPaths: paths,
      });
    }
  }

  return atoms;
}

/**
 * Generate a coverage manifest from rule modules.
 */
export function generateRuleCoverageManifest(
  systemId: string,
  modules: readonly ConventionModule[],
): RuleCoverageManifest {
  const atoms = enumerateRuleAtoms(modules);

  const atomsByModule = new Map<string, RuleAtom[]>();
  for (const atom of atoms) {
    const list = atomsByModule.get(atom.moduleId);
    if (list) {
      list.push(atom);
    } else {
      atomsByModule.set(atom.moduleId, [atom]);
    }
  }

  return {
    systemId,
    totalModules: modules.length,
    totalAtoms: atoms.length,
    atoms,
    atomsByModule,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function pathsEqual(
  a: { phaseGuards: string | readonly string[] | undefined; turnGuard: TurnRole | undefined },
  b: { phaseGuards: string | readonly string[] | undefined; turnGuard: TurnRole | undefined },
): boolean {
  if (a.turnGuard !== b.turnGuard) return false;
  if (a.phaseGuards === b.phaseGuards) return true;
  if (a.phaseGuards === undefined || b.phaseGuards === undefined) return false;
  if (typeof a.phaseGuards === "string" && typeof b.phaseGuards === "string") {
    return a.phaseGuards === b.phaseGuards;
  }
  if (Array.isArray(a.phaseGuards) && Array.isArray(b.phaseGuards)) {
    if (a.phaseGuards.length !== b.phaseGuards.length) return false;
    return a.phaseGuards.every((v, i) => v === (b.phaseGuards as readonly string[])[i]);
  }
  return false;
}
