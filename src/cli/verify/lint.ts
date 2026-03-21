/**
 * Module linting — static analysis of RuleModule structure.
 *
 * Detects unreachable phases, dead rules, overly broad rules,
 * orphan transitions, undeclared kernel writes, and duplicate encodings.
 */

import type { RuleModule, KernelExpr } from "../../conventions/core/rule-module";
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
export function computePhaseReachability(mod: RuleModule): Set<string> {
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

/** Normalize match.local to string array. */
function normalizeLocal(
  local: string | readonly string[] | undefined,
): readonly string[] | null {
  if (local === undefined) return null;
  if (Array.isArray(local)) {
    return local as readonly string[];
  }
  return [String(local)];
}

/** Extract all phase names referenced in rule match.local guards. */
function collectGuardPhases(mod: RuleModule): Set<string> {
  const phases = new Set<string>();
  for (const rule of mod.rules) {
    const locals = normalizeLocal(rule.match.local);
    if (locals) {
      for (const p of locals) {
        phases.add(p);
      }
    }
  }
  return phases;
}

/** Recursively collect kernel field names read by a KernelExpr. */
function collectKernelReads(expr: KernelExpr, fields: Set<string>): void {
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
  mod: RuleModule,
  reachable: Set<string>,
): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];
  const guardPhases = collectGuardPhases(mod);

  for (const phase of guardPhases) {
    if (!reachable.has(phase)) {
      diags.push({
        ruleId: "unreachable-phase",
        severity: "error",
        message: `Phase "${phase}" is referenced in a rule guard but is not reachable from initial phase "${mod.local.initial}"`,
        location: { phase },
        suggestion: `Add a transition path from "${mod.local.initial}" to "${phase}", or remove the guard`,
      });
    }
  }

  return diags;
}

/**
 * Rules guarded by unreachable phases — these rules can never fire.
 */
export function detectDeadRules(
  mod: RuleModule,
  reachable: Set<string>,
): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < mod.rules.length; i++) {
    const rule = mod.rules[i]!;
    const locals = normalizeLocal(rule.match.local);
    if (!locals) continue;

    // Rule is dead if ALL its local guards are unreachable
    const allUnreachable = locals.every((p) => !reachable.has(p));
    if (allUnreachable) {
      diags.push({
        ruleId: "dead-rule",
        severity: "error",
        message: `Rule ${i} is guarded by unreachable phase(s): ${locals.join(", ")}`,
        location: { ruleIndex: i, phase: locals[0] },
        suggestion: "Ensure the phase is reachable or remove the rule",
      });
    }
  }

  return diags;
}

/**
 * Rules with no `match.local` AND no `match.route` — too permissive.
 */
export function detectBroadRules(mod: RuleModule): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < mod.rules.length; i++) {
    const rule = mod.rules[i]!;
    if (rule.match.local === undefined && rule.match.route === undefined) {
      diags.push({
        ruleId: "broad-rule",
        severity: "warn",
        message: `Rule ${i} has no local phase guard and no route guard — may over-match`,
        location: { ruleIndex: i },
        suggestion: "Add a match.local or match.route constraint to scope this rule",
      });
    }
  }

  return diags;
}

/**
 * Transitions whose `from` phases are not reachable.
 */
export function detectOrphanTransitions(
  mod: RuleModule,
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
 * `kernelDelta` fields not read by any `KernelExpr` in same module.
 */
export function detectUndeclaredWrites(mod: RuleModule): LintDiagnostic[] {
  // Collect all kernel fields read by any rule's match.kernel
  const readFields = new Set<string>();
  for (const rule of mod.rules) {
    if (rule.match.kernel) {
      collectKernelReads(rule.match.kernel, readFields);
    }
  }

  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < mod.rules.length; i++) {
    const rule = mod.rules[i]!;
    for (const claim of rule.claims) {
      if (!claim.kernelDelta) continue;
      for (const field of Object.keys(claim.kernelDelta)) {
        if (!readFields.has(field)) {
          diags.push({
            ruleId: "undeclared-write",
            severity: "warn",
            message: `Rule ${i} writes kernelDelta.${field} but no KernelExpr in this module reads it`,
            location: { ruleIndex: i },
            suggestion: `Add a kernel guard that reads "${field}", or remove the write if it's only for downstream modules`,
          });
        }
      }
    }
  }

  return diags;
}

/**
 * Multiple claims in the same rule with the same `encoding.defaultCall`
 * AND the same `meaningId`. Different meaningIds with the same encoding
 * are valid (different hand shapes that make the same bid).
 */
export function detectDuplicateEncodings(mod: RuleModule): LintDiagnostic[] {
  const diags: LintDiagnostic[] = [];

  for (let i = 0; i < mod.rules.length; i++) {
    const rule = mod.rules[i]!;
    if (rule.claims.length < 2) continue;

    // Key: encoding+meaningId pair
    const seen = new Map<string, number>();
    for (let c = 0; c < rule.claims.length; c++) {
      const claim = rule.claims[c]!;
      const key = `${callKey(claim.surface.encoding.defaultCall)}::${claim.surface.meaningId}`;
      const prev = seen.get(key);
      if (prev !== undefined) {
        diags.push({
          ruleId: "duplicate-encoding",
          severity: "error",
          message: `Rule ${i} has duplicate encoding+meaningId "${callKey(claim.surface.encoding.defaultCall)}" (${claim.surface.meaningId}) in claims ${prev} and ${c}`,
          location: { ruleIndex: i },
          suggestion: "Ensure each claim in a rule has a distinct defaultCall+meaningId combination",
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
export function lintModule(mod: RuleModule): LintDiagnostic[] {
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
