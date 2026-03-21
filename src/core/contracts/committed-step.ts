/**
 * CommittedStep — one adjudicated auction action in the observation log.
 *
 * Part of the continuation composition redesign (Phase 2). The observation log
 * records what each bid communicated in convention-erased terms, enabling rule
 * modules to match on bridge semantics rather than FSM state IDs.
 *
 * **NegotiationState** is a small, closed, purely semantic state owned by the framework.
 * Every field passes the kernel litmus test:
 *   1. Semantic (not genealogical) — describes negotiation state, not route history
 *   2. Reused across unrelated modules — not convention-specific
 *   3. Stable under route variations — same meaning regardless of how you got here
 *   4. Set by module effects via negotiationDelta — not mechanically derived
 */

import type { Seat, Call } from "../../engine/types";
import type { BidAction, BidSuitName } from "./bid-action";
import type { PublicSnapshot } from "./module-surface";

// ── NegotiationState ──────────────────────────────────────────────────────

export interface NegotiationState {
  readonly fitAgreed: {
    readonly strain: BidSuitName;
    readonly confidence: "tentative" | "final";
  } | null;
  readonly forcing: "none" | "one-round" | "game";
  readonly captain: "opener" | "responder" | "undecided";
  readonly competition:
    | "uncontested"
    | "doubled"
    | "redoubled"
    | {
        readonly kind: "overcalled";
        readonly strain: BidSuitName;
        readonly level: number;
      };
}

export const INITIAL_NEGOTIATION: NegotiationState = Object.freeze({
  fitAgreed: null,
  forcing: "none",
  captain: "undecided",
  competition: "uncontested",
} as const);

export type NegotiationDelta = Partial<NegotiationState>;

// ── ClaimRef ─────────────────────────────────────────────────────────

/** Minimal identifying info from the winning arbitration proposal. */
export interface ClaimRef {
  readonly moduleId: string;
  readonly meaningId: string;
  readonly semanticClassId: string;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
}

// ── CommittedStep ────────────────────────────────────────────────────

/** One adjudicated auction action in the observation log. */
export interface CommittedStep {
  readonly actor: Seat;
  readonly call: Call;
  readonly resolvedClaim: ClaimRef | null;
  readonly publicActions: readonly BidAction[];
  readonly negotiationDelta: NegotiationDelta;
  readonly stateAfter: NegotiationState;
  readonly status: "resolved" | "raw-only" | "ambiguous" | "off-system";
}

// ── AuctionContext ───────────────────────────────────────────────────

/**
 * Composite wrapper — NOT on PublicSnapshot.
 * Keeps PublicSnapshot clean as a cross-boundary DTO.
 */
export interface AuctionContext {
  readonly snapshot: PublicSnapshot;
  readonly log: readonly CommittedStep[];
}
