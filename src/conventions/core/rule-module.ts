/**
 * Rule pattern primitives — types for declarative rule-based surface selection.
 *
 * Defines LocalFsm, Claim, StateEntry, and pattern types (ObsPattern, RouteExpr,
 * NegotiationExpr, PhaseTransition, TurnRole) used by ConventionModule.
 *
 * Import direction: rule-module.ts → core/contracts/ only.
 * convention-module.ts → rule-module.ts (one-way).
 */

import type {
  BidActionType,
  ObsSuit,
  BidSuitName,
  HandFeature,
  HandStrength,
} from "../../core/contracts/bid-action";
import type { NegotiationState, NegotiationDelta } from "../../core/contracts/committed-step";
import type { BidMeaning } from "../../core/contracts/meaning";
// FactCatalogExtension import removed — facts now live on ConventionModule, not here.

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
  readonly act: BidActionType | "any";
  readonly feature?: HandFeature;
  readonly suit?: ObsSuit;
  readonly strain?: BidSuitName;
  readonly strength?: HandStrength;
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

// ── NegotiationExpr ───────────────────────────────────────────────────────

/** Predicate over NegotiationState. */
export type NegotiationExpr =
  | { readonly kind: "fit"; readonly strain?: BidSuitName }
  | { readonly kind: "no-fit" }
  | { readonly kind: "forcing"; readonly level: NegotiationState["forcing"] }
  | { readonly kind: "captain"; readonly who: NegotiationState["captain"] }
  | { readonly kind: "uncontested" }
  | {
      readonly kind: "overcalled";
      readonly below?: { readonly level: number; readonly strain: BidSuitName };
    }
  | { readonly kind: "doubled" }
  | { readonly kind: "redoubled" }
  | { readonly kind: "and"; readonly exprs: readonly NegotiationExpr[] }
  | { readonly kind: "or"; readonly exprs: readonly NegotiationExpr[] }
  | { readonly kind: "not"; readonly expr: NegotiationExpr };

// ── PhaseTransition ──────────────────────────────────────────────────

/**
 * Local FSM advancement from CommittedStep observations.
 *
 * Fires if ANY observation in CommittedStep.publicActions matches the `on` pattern.
 * This is intentional — a step like Smolen emits both show(shortMajor) +
 * force(game), and a transition on show(shortMajor) should fire regardless
 * of other co-emitted observations.
 */
export interface PhaseTransition<Phase extends string> {
  readonly from: Phase | readonly Phase[];
  readonly to: Phase;
  readonly on: ObsPattern;
}

// ── LocalFsm ────────────────────────────────────────────────────────

/** A module's local finite state machine — scopes rule activation by phase. */
export interface LocalFsm<Phase extends string = string> {
  readonly initial: Phase;
  readonly transitions: readonly PhaseTransition<Phase>[];
}

// ── Claim ────────────────────────────────────────────────────────────

/** One surface claim emitted by a rule, with optional kernel delta. */
export interface Claim {
  readonly surface: BidMeaning;
  readonly negotiationDelta?: NegotiationDelta;
}

// ── StateEntry ──────────────────────────────────────────────────────

/**
 * Groups surfaces by conversation state — "in this state, these bids
 * are available." Flatter, inline authoring with group-level negotiationDelta.
 *
 * All activation fields are optional wildcards (matching anything when omitted).
 * `negotiationDelta` is shared by all surfaces in the entry.
 * For per-surface deltas, use multiple StateEntry objects with the same phase/turn.
 */
export interface StateEntry<Phase extends string> {
  readonly phase: Phase | readonly Phase[];
  readonly turn?: TurnRole;
  readonly kernel?: NegotiationExpr;
  readonly route?: RouteExpr;
  readonly negotiationDelta?: NegotiationDelta;
  readonly surfaces: readonly BidMeaning[];
}
