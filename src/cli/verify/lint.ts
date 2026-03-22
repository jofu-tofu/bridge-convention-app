/**
 * Module linting — static analysis of ConventionModule structure.
 *
 * Detects unreachable phases, dead rules, overly broad rules,
 * orphan transitions, undeclared kernel writes, and duplicate encodings.
 */

import type { ConventionModule, NegotiationExpr } from "../../conventions";
import type { LintDiagnostic } from "./types";
import { callKey } from "../../engine/call-helpers";

// ── Phase reachability ──────────────────────────────────────────────

/** Normalize from field to string array (handles Phase | readonly Phase[]). */
function normalizeFroms(from: string | readonly string[]): readonly string[] {
  if (Array.isArray(from)) {
    return from as readonly string[];
  }
  return [String(from)];
}

/**
 * BFS from `mod.local.initial` through transitions.
 * Transitions are edges from→to regardless of the `on` predicate.
 * If `from` is an array, each element is a source.
 */
export function computePhaseReachability(mod: ConventionModule): Set<string> {
  const adjacency = new Map<string, string[]>();

  for (const t of mod.local.transitions) {
    const froms = normalizeFroms(t.from);
    for (const f of froms) {
      const existing = adjacency.get(f);
      if (existing) {
        existing.push(t.to);
      } else {
        adjacency.set(f, [t.to]);
      }
    }
  }

  const reachable = new Set<string>();
  const queue: string[] = [mod.local.initial];
  reachable.add(mod.local.initial);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  return reachable;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Normalize phase to string array. */
function normalizePhase(
  phase: string | readonly string[] | undefined,
): readonly string[] | null {
  if (phase === undefined) return null;
  if (Array.isArray(phase)) {
    return phase as readonly string[];
  }
  return [String(phase)];
}

/** Extract all phase names referenced in state entry phase guards. */
function collectGuardPhases(mod: ConventionModule): Set<string> {
  const phases = new Set<string>();
  for (const entry of (mod.states ?? [])) {
    const phaseList = normalizePhase(entry.phase);
    if (phaseList) {
      for (const p of phaseList) {
        phases.add(p);
      }
    }
  }
  return phases;
}

/** Recursively collect kernel field names read by a NegotiationExpr. */
function collectKernelReads(expr: NegotiationExpr, fields: Set<string>): void {
  switch (expr.kind) {
    case "fit":
    case "no-fit":
      fields.add("fitAgreed");
      break;
    case "forcing":
      fields.add("forcing");
      break;
    case "captain":
      fields.add("captain");
      break;
    case "uncontested":
    case "overcalled":
    case "doubled":
    case "redoubled":
      fields.add("competition");
      break;
    case "and":
    case "or":
      for (const sub of expr.exprs) {
        collectKernelReads(sub, fields);
      }
      break;
    case "not":
      collectKernelReads(expr.expr, fields);
      break;
  }
}

// ── Detectors ───────────────────────────────────────────────────────

/**
 * Phases referenced in `match.local` guards but not in the reachable set.
 */
export function detectUnreachablePhases(
  mod: ConventionModule,
  reachable: Set<string>,
): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];
  const guardPhases = collectGuardPhases(mod);

  for (const phase of guardPhases) {
    if (!reachable.has(phase)) {
      diags.push({
        ruleId: "unreachable-phase",
        severity: "error",
        message: `Phase "${phase}" is referenced in a state entry guard but is not reachable from initial phase "${mod.local.initial}"`,
        location: { phase },
        suggestion: `Add a transition path from "${mod.local.initial}" to "${phase}", or remove the guard`,
      });
    }
  }

  return diags;
}

/**
 * State entries guarded by unreachable phases — these entries can never activate.
 */
export function detectDeadRules(
  mod: ConventionModule,
  reachable: Set<string>,
): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < (mod.states ?? []).length; i++) {
    const entry = (mod.states ?? [])[i]!;
    const phases = normalizePhase(entry.phase);
    if (!phases) continue;

    // Entry is dead if ALL its phase guards are unreachable
    const allUnreachable = phases.every((p) => !reachable.has(p));
    if (allUnreachable) {
      diags.push({
        ruleId: "dead-rule",
        severity: "error",
        message: `State entry ${i} is guarded by unreachable phase(s): ${phases.join(", ")}`,
        location: { ruleIndex: i, phase: phases[0] },
        suggestion: "Ensure the phase is reachable or remove the state entry",
      });
    }
  }

  return diags;
}

/**
 * StateEntry always requires a `phase` field, so the "no local phase guard"
 * issue that existed with legacy Rules doesn't apply. No diagnostics needed.
 */
export function detectBroadRules(_mod: ConventionModule): LintDiagnostic[] {
  return [];
}

/**
 * Transitions whose `from` phases are not reachable.
 */
export function detectOrphanTransitions(
  mod: ConventionModule,
  reachable: Set<string>,
): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < mod.local.transitions.length; i++) {
    const t = mod.local.transitions[i]!;
    const froms = normalizeFroms(t.from);

    // Orphan if ALL from-phases are unreachable
    const allUnreachable = froms.every((f) => !reachable.has(f));
    if (allUnreachable) {
      diags.push({
        ruleId: "orphan-transition",
        severity: "error",
        message: `Transition ${i} originates from unreachable phase(s): ${froms.join(", ")}`,
        location: { transitionIndex: i, phase: froms[0] },
        suggestion: "Ensure the source phase is reachable or remove the transition",
      });
    }
  }

  return diags;
}

/**
 * `negotiationDelta` fields not read by any `NegotiationExpr` in same module.
 */
export function detectUndeclaredWrites(mod: ConventionModule): LintDiagnostic[] {
  // Collect all kernel fields read by any state entry's kernel guard
  const readFields = new Set<string>();
  for (const entry of (mod.states ?? [])) {
    if (entry.kernel) {
      collectKernelReads(entry.kernel, readFields);
    }
  }

  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < (mod.states ?? []).length; i++) {
    const entry = (mod.states ?? [])[i]!;
    if (!entry.negotiationDelta) continue;
    for (const field of Object.keys(entry.negotiationDelta)) {
      if (!readFields.has(field)) {
        diags.push({
          ruleId: "undeclared-write",
          severity: "warn",
          message: `State entry ${i} writes negotiationDelta.${field} but no NegotiationExpr in this module reads it`,
          location: { ruleIndex: i },
          suggestion: `Add a kernel guard that reads "${field}", or remove the write if it's only for downstream modules`,
        });
      }
    }
  }

  return diags;
}

/**
 * Multiple surfaces in the same state entry with the same `encoding.defaultCall`
 * AND the same `meaningId`. Different meaningIds with the same encoding
 * are valid (different hand shapes that make the same bid).
 */
export function detectDuplicateEncodings(mod: ConventionModule): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < (mod.states ?? []).length; i++) {
    const entry = (mod.states ?? [])[i]!;
    if (entry.surfaces.length < 2) continue;

    // Key: encoding+meaningId pair
    const seen = new Map<string, number>();
    for (let c = 0; c < entry.surfaces.length; c++) {
      const surface = entry.surfaces[c]!;
      const key = `${callKey(surface.encoding.defaultCall)}::${surface.meaningId}`;
      const prev = seen.get(key);
      if (prev !== undefined) {
        diags.push({
          ruleId: "duplicate-encoding",
          severity: "error",
          message: `State entry ${i} has duplicate encoding+meaningId "${callKey(surface.encoding.defaultCall)}" (${surface.meaningId}) in surfaces ${prev} and ${c}`,
          location: { ruleIndex: i },
          suggestion: "Ensure each surface in a state entry has a distinct defaultCall+meaningId combination",
        });
      } else {
        seen.set(key, c);
      }
    }
  }

  return diags;
}

// ── Main entry ──────────────────────────────────────────────────────

/** Run all lint rules on a module. */
export function lintModule(mod: ConventionModule): LintDiagnostic[] {
  const reachable = computePhaseReachability(mod);
  return [
    ...detectUnreachablePhases(mod, reachable),
    ...detectDeadRules(mod, reachable),
    ...detectBroadRules(mod),
    ...detectOrphanTransitions(mod, reachable),
    ...detectUndeclaredWrites(mod),
    ...detectDuplicateEncodings(mod),
  ];
}
