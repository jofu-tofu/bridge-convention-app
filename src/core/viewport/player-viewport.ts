// ── Player Viewport ─────────────────────────────────────────────────
//
// The explicit information boundary between the engine and the player.
//
// Everything the player sees flows through this type — no component or
// CLI agent should access Deal, opponent hands, or internal evaluation
// state directly.  If data isn't in the viewport, the player can't see it.
//
// Two consumers:
//   1. Svelte UI — renders the viewport as pixels
//   2. CLI harness — serializes the viewport as JSON for agent evaluation

import type { Call, Hand, Seat, Vulnerability, SuitLength } from "../../engine/types";

// ── Bidding Viewport ────────────────────────────────────────────────

/** Complete view of the game state from the player's seat during bidding. */
export interface BiddingViewport {
  // ── Player identity ───────────────────────────────────────────
  readonly seat: Seat;
  readonly conventionName: string;

  // ── Player's hand (only theirs) ───────────────────────────────
  readonly hand: Hand;
  readonly handEvaluation: HandEvaluationView;
  readonly handSummary: string; // "4♠ 3♥ 3♦ 3♣, 15 HCP"

  // ── Visible hands (face-up seats only, others absent) ─────────
  /** Only seats the player can see.  During bidding, typically just
   *  the player's own seat.  During play, includes dummy. */
  readonly visibleHands: Partial<Record<Seat, Hand>>;

  // ── Auction state ─────────────────────────────────────────────
  readonly auctionEntries: readonly AuctionEntryView[];
  readonly dealer: Seat;
  readonly vulnerability: Vulnerability;

  // ── Bidding options ───────────────────────────────────────────
  /** All legal calls at the current auction position. */
  readonly legalCalls: readonly Call[];
  /** System-card knowledge: what each legal call means in this convention.
   *  Mirrors what a human would know from their partnership agreement. */
  readonly biddingOptions: readonly BiddingOptionView[];

  // ── Turn state ────────────────────────────────────────────────
  readonly isUserTurn: boolean;
  readonly currentBidder: Seat;
}

/** Compact hand evaluation visible to the player (their own hand only). */
export interface HandEvaluationView {
  readonly hcp: number;
  readonly shape: SuitLength; // [spades, hearts, diamonds, clubs]
  readonly isBalanced: boolean;
  readonly totalPoints: number;
}

/** A single auction entry as the player sees it. */
export interface AuctionEntryView {
  readonly seat: Seat;
  readonly call: Call;
  /** Formatted display string: "1NT", "2♣", "Pass", "Dbl". */
  readonly callDisplay: string;
  /** Alert/announcement label visible to the player (e.g., "15–17 HCP", "Transfer"). */
  readonly alertLabel?: string;
  /** ACBL annotation type: alert (conventional), announce (spoken), educational (learning). */
  readonly annotationType?: "alert" | "announce" | "educational";
}

/** What a specific legal call means — system-card knowledge. */
export interface BiddingOptionView {
  readonly call: Call;
  readonly callDisplay: string;
  /** Convention meaning (e.g., "Stayman — asks for 4-card major").
   *  Undefined for calls with no convention-level meaning. */
  readonly teachingLabel?: string;
  /** Whether this bid would need to be alerted to opponents. */
  readonly isAlertable: boolean;
  /** Authored recommendation band from the convention.  Undefined for
   *  calls that aren't among the convention's active surfaces. */
  readonly recommendation?: "must" | "should" | "may" | "avoid";
}

// ── Bid Feedback Viewport ───────────────────────────────────────────
//
// What the player sees AFTER making a bid.  This is the viewport-safe
// projection of the engine's BidFeedback — same information a human
// player would see in the UI feedback panel.

export type ViewportBidGrade =
  | "correct"
  | "correct-not-preferred"
  | "acceptable"
  | "near-miss"
  | "incorrect";

/** Feedback shown to the player after bidding. */
export interface ViewportBidFeedback {
  readonly grade: ViewportBidGrade;
  readonly userCall: Call;
  readonly userCallDisplay: string;

  // ── Correct answer (shown after wrong/near-miss bids) ─────────
  readonly correctCall?: Call;
  readonly correctCallDisplay?: string;
  readonly correctBidLabel?: string; // "Stayman 2♣"
  readonly correctBidExplanation?: string; // "Ask opener for 4-card major"

  // ── Structured explanation ────────────────────────────────────
  /** Condition nodes from the teaching explanation (e.g., "HCP ≥ 8 ✓"). */
  readonly conditions?: readonly ConditionView[];

  // ── Alternatives ──────────────────────────────────────────────
  readonly acceptableAlternatives?: readonly AlternativeView[];
  readonly nearMisses?: readonly NearMissView[];

  // ── Partner context ───────────────────────────────────────────
  /** What we know about partner's hand from their bids. */
  readonly partnerHandSpace?: string; // "Partner shows 15–17 HCP, balanced"

  // ── Convention context ────────────────────────────────────────
  /** Conventions that contributed to the evaluation. */
  readonly conventionsApplied?: readonly ConventionView[];

  // ── Control ───────────────────────────────────────────────────
  /** True when the player must retry (near-miss or incorrect). */
  readonly requiresRetry: boolean;
}

/** A condition node in the teaching explanation. */
export interface ConditionView {
  readonly description: string; // "HCP ≥ 8"
  readonly passed: boolean;
}

/** An acceptable alternative bid. */
export interface AlternativeView {
  readonly call: Call;
  readonly callDisplay: string;
  readonly label: string; // Meaning name
  readonly reason: string; // Why it's acceptable
  readonly fullCredit: boolean;
}

/** A near-miss bid that almost qualifies. */
export interface NearMissView {
  readonly call: Call;
  readonly callDisplay: string;
  readonly reason: string; // Why it's a near-miss
}

/** Convention contribution visible in feedback. */
export interface ConventionView {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
}
