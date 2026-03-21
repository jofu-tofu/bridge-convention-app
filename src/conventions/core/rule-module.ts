/**
 * RuleModule — declarative convention module for rule-based surface selection.
 *
 * Replaces the FSM + skeleton + hookTransitions model with pattern matching
 * over a canonical observation stream. Modules match on bridge semantics
 * (via CanonicalObs), not on implementation-specific FSM state IDs.
 *
 * **Phase 3 scope:** RuleModule handles surface SELECTION only.
 * Kernel state tracking still uses the old FSM (via MachineRegisters).
 * Phase 4+ adds `effects` on claims for full FSM replacement.
 */

import type {
  ObsAct,
  ObsSuit,
  ObsStrain,
  ObsFeature,
  ObsStrength,
} from "../../core/contracts/canonical-observation";
import type { KernelState, KernelDelta } from "../../core/contracts/committed-step";
import type { MeaningSurface } from "../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../core/contracts/explanation-catalog";

// ── TurnRole ─────────────────────────────────────────────────────────

/** Role of a bidder relative to the opening bid. */
export type TurnRole = "opener" | "responder" | "opponent";

// ── ObsPattern ───────────────────────────────────────────────────────

/**
 * Predicate over a single canonical observation.
 *
 * Matches if `act` matches AND all specified optional fields match.
 * Unspecified fields are wildcards. Use `{ act: "any" }` to match any observation.
 *
 * Optional `actor` field filters by who made the observation (opener, responder,
 * or opponent). When omitted, matches any actor (backward compatible).
 */
export interface ObsPattern {
  readonly act: ObsAct | "any";
  readonly feature?: ObsFeature;
  readonly suit?: ObsSuit;
  readonly strain?: ObsStrain;
  readonly strength?: ObsStrength;
  readonly actor?: TurnRole;
}

// ── RouteExpr ────────────────────────────────────────────────────────

/**
 * Pattern over the observation log.
 *
 * "subseq" matches observations as a SUBSEQUENCE of the log — the patterns must
 * appear in order but may be separated by any number of non-matching steps.
 * This is how bridge players think: "after a Stayman inquiry and a denial"
 * doesn't care about intervening passes or opponent bids.
 *
 * "last" matches only the final step's observations.
 * "contains" matches if ANY step in the log has a matching observation.
 */
export type RouteExpr =
  | { readonly kind: "subseq"; readonly steps: readonly ObsPattern[] }
  | { readonly kind: "last"; readonly pattern: ObsPattern }
  | { readonly kind: "contains"; readonly pattern: ObsPattern }
  | { readonly kind: "and"; readonly exprs: readonly RouteExpr[] }
  | { readonly kind: "or"; readonly exprs: readonly RouteExpr[] }
  | { readonly kind: "not"; readonly expr: RouteExpr };
  // Known extension point (Phase 4+): "strict-seq" for consecutive-step matching.

// ── KernelExpr ───────────────────────────────────────────────────────

/** Predicate over KernelState. */
export type KernelExpr =
  | { readonly kind: "fit"; readonly strain?: ObsStrain }
  | { readonly kind: "no-fit" }
  | { readonly kind: "forcing"; readonly level: KernelState["forcing"] }
  | { readonly kind: "captain"; readonly who: KernelState["captain"] }
  | { readonly kind: "uncontested" }
  | {
      readonly kind: "overcalled";
      readonly below?: { readonly level: number; readonly strain: ObsStrain };
    }
  | { readonly kind: "doubled" }
  | { readonly kind: "redoubled" }
  | { readonly kind: "and"; readonly exprs: readonly KernelExpr[] }
  | { readonly kind: "or"; readonly exprs: readonly KernelExpr[] }
  | { readonly kind: "not"; readonly expr: KernelExpr };

// ── PhaseTransition ──────────────────────────────────────────────────

/**
 * Local FSM advancement from CommittedStep observations.
 *
 * Fires if ANY observation in CommittedStep.publicObs matches the `on` pattern.
 * This is intentional — a step like Smolen emits both show(shortMajor) +
 * force(game), and a transition on show(shortMajor) should fire regardless
 * of other co-emitted observations.
 */
export interface PhaseTransition<Phase extends string> {
  readonly from: Phase | readonly Phase[];
  readonly to: Phase;
  readonly on: ObsPattern;
}

// ── Rule ─────────────────────────────────────────────────────────────

/**
 * When match conditions hold, these claims are active.
 *
 * DESIGN INVARIANT: Route patterns and local phases should be used together.
 * A route pattern without a local phase guard can over-match in long auctions.
 */
export interface Rule<Phase extends string> {
  readonly match: {
    readonly turn?: "opener" | "responder" | "opponent";
    readonly kernel?: KernelExpr;
    readonly route?: RouteExpr;
    readonly local?: Phase | readonly Phase[];
  };
  readonly claims: readonly {
    readonly surface: MeaningSurface;
    readonly kernelDelta?: KernelDelta;
  }[];
}

// ── RuleModule ───────────────────────────────────────────────────────

/** One module — no special cases. */
export interface RuleModule<Phase extends string = string> {
  readonly id: string;
  readonly local: {
    readonly initial: Phase;
    readonly transitions: readonly PhaseTransition<Phase>[];
  };
  readonly rules: readonly Rule<Phase>[];
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}
