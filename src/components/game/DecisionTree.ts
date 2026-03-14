import type { BiddingContext } from "../../conventions/core";
import type { Call, Hand } from "../../engine/types";
import { Seat, Suit, Rank } from "../../engine/types";
import { createBiddingContext } from "../../conventions/core";
import { evaluateHand } from "../../engine/hand-evaluator";

export interface TreeDisplayRow {
  readonly id: string;
  readonly depth: number;
  readonly type: "decision" | "bid" | "fallback";
  readonly name: string;
  readonly conditionLabel: string | null;
  readonly conditionCategory: "auction" | "hand" | null;
  /** Original raw label before incremental/formatting transforms (for tooltips). */
  readonly fullConditionLabel?: string | null;
  readonly meaning: string | null;
  readonly callResolver: ((ctx: BiddingContext) => Call) | null;
  readonly hasChildren: boolean;
  readonly parentId: string | null;
  readonly branch: "yes" | "no" | null;
  /** Teaching explanation from condition registry (null if not available). */
  readonly teachingExplanation: string | null;
  /** Decision node teaching metadata from explanations (null for non-decision rows). */
  readonly decisionMetadata: {
    readonly whyThisMatters?: string;
    readonly commonMistake?: string;
    readonly denialImplication?: string;
  } | null;
  /** Bid node teaching metadata from explanations (null for non-bid rows). */
  readonly bidMetadata: {
    readonly whyThisBid?: string;
    readonly isArtificial?: boolean;
    readonly forcingType?: string;
  } | null;
  /** Denial implication from parent decision node (only on NO-branch rows). */
  readonly denialImplication: string | null;
  /** Whether the convention system is off for this display context. */
  readonly systemOff?: boolean;
  /** Whether this intent was suppressed by an overlay hook. */
  readonly suppressedByOverlay?: boolean;
  /** Whether this intent's call was overridden by an overlay resolver. */
  readonly overriddenByOverlay?: boolean;
}

// ─── Dummy context for display ───────────────────────────────

/** Minimal dummy hand for resolving convention calls in display contexts.
 *  4-3-3-3 shape, 9 HCP (A=4 + K=3 + Q=2). */
export const DUMMY_HAND: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.Ten },
    { suit: Suit.Spades, rank: Rank.Five },
    { suit: Suit.Spades, rank: Rank.Three },
    { suit: Suit.Hearts, rank: Rank.King },
    { suit: Suit.Hearts, rank: Rank.Eight },
    { suit: Suit.Hearts, rank: Rank.Four },
    { suit: Suit.Diamonds, rank: Rank.Queen },
    { suit: Suit.Diamonds, rank: Rank.Six },
    { suit: Suit.Diamonds, rank: Rank.Two },
    { suit: Suit.Clubs, rank: Rank.Nine },
    { suit: Suit.Clubs, rank: Rank.Five },
    { suit: Suit.Clubs, rank: Rank.Three },
  ],
};

/** Create a BiddingContext with the dummy hand and empty auction.
 *  Used by display components that need to resolve convention calls
 *  without a real game context. */
export function createDummyContext(): BiddingContext {
  return createBiddingContext({
    hand: DUMMY_HAND,
    auction: { entries: [], isComplete: false },
    seat: Seat.South,
    evaluation: evaluateHand(DUMMY_HAND),
  });
}
