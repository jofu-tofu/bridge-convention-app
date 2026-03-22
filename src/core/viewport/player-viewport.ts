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

import type { Call, Hand, Seat, Vulnerability, SuitLength, DistributionPoints, Contract, PlayedCard, Trick, Card, Suit } from "../../engine/types";
import type { BidGrade } from "../contracts/teaching-grading";
import type { BidHistoryEntry } from "../contracts/bidding";

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
  /** Distribution point breakdown: shortness (voids/singletons/doubletons)
   *  and length (suits longer than 4 cards). */
  readonly distributionPoints: DistributionPoints;
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

export type ViewportBidGrade = `${BidGrade}`;

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

// ── Teaching Detail (oracle-derived, post-bid only) ─────────────────
//
// Rich teaching data from the evaluation oracle.  Available ONLY after
// the player has bid and been graded.  Both CLI (--json output) and UI
// ("Show Answer" expansion) consume this through the same type.
//
// This is NOT part of the playing sequence — it's the oracle's teaching
// slice, exposed after grading for pedagogical feedback.

import type { ExplanationNode, WhyNotEntry, ConventionContribution, MeaningView, CallProjection, ParseTreeView } from "../contracts/teaching-projection";
import type { EncoderKind } from "../contracts/provenance";

/** Post-bid teaching data derived from the evaluation oracle. */
export interface TeachingDetail {
  // ── Correct answer context ────────────────────────────────────
  /** Hand summary for the correct bid (e.g., "4♠ 3♥ 3♦ 3♣, 15 HCP"). */
  readonly handSummary?: string;
  /** Fallback explanation when teaching projection is unavailable. */
  readonly fallbackExplanation?: string;

  // ── Teaching projection data ──────────────────────────────────
  /** Primary explanation nodes (conditions with pass/fail). */
  readonly primaryExplanation?: readonly ExplanationNode[];
  /** Why-not entries for alternative bids. */
  readonly whyNot?: readonly WhyNotEntry[];
  /** Convention contributions (which modules were evaluated). */
  readonly conventionsApplied?: readonly ConventionContribution[];
  /** Meaning views: all meanings with live/eliminated status. */
  readonly meaningViews?: readonly MeaningView[];
  /** Call views: how each call was projected (truth/acceptable/wrong). */
  readonly callViews?: readonly CallProjection[];

  // ── Partner hand space ────────────────────────────────────────
  /** Partner summary from hand space analysis. */
  readonly partnerSummary?: string;
  /** Hand archetypes (HCP ranges, shapes). */
  readonly archetypes?: readonly {
    readonly label: string;
    readonly hcpRange: { readonly min: number; readonly max: number };
    readonly shapePattern: string;
  }[];

  // ── Encoding trace ────────────────────────────────────────────
  /** How the meaning was encoded into a concrete call (null for trivial). */
  readonly encoderKind?: EncoderKind;

  // ── Practical recommendation ──────────────────────────────────
  /** Expert-level practical recommendation (when different from textbook). */
  readonly practicalRecommendation?: {
    readonly topCandidateCall: Call;
    readonly rationale: string;
  };

  // ── Teaching resolution ───────────────────────────────────────
  /** The primary (textbook) bid. */
  readonly primaryBid?: Call;
  /** Acceptable alternative bids with reasons. */
  readonly acceptableBids?: readonly {
    readonly call: Call;
    readonly meaning: string;
    readonly reason: string;
    readonly fullCredit: boolean;
  }[];
  /** Near-miss bids with reasons. */
  readonly nearMissCalls?: readonly { readonly call: Call; readonly reason: string }[];

  // ── Decision metadata ─────────────────────────────────────────
  /** How ambiguous the bid decision was (0 = clear-cut, 0.8 = highly ambiguous).
   *  Derived from the number and tier of acceptable alternatives. */
  readonly ambiguityScore?: number;
  /** How the teaching grading was resolved.
   *  "exact" = only one correct bid; "primary_plus_acceptable" = primary + alternatives;
   *  "intent_based" = surface-group-aware grading. */
  readonly gradingType?: "exact" | "primary_plus_acceptable" | "intent_based";

  // ── Practical score breakdown ─────────────────────────────────
  /** Component-level breakdown of the practical scorer's recommendation.
   *  Shows how fit, HCP, convention distance, and misunderstanding risk
   *  contributed to the practical recommendation. */
  readonly practicalScoreBreakdown?: {
    readonly fitScore: number;
    readonly hcpScore: number;
    readonly conventionDistance: number;
    readonly misunderstandingRisk: number;
    readonly totalScore: number;
  };

  // ── Evaluation completeness ───────────────────────────────────
  /** True when the pipeline evaluated every possible meaning (no early exit). */
  readonly evaluationExhaustive?: boolean;
  /** True when no convention surface matched and the pipeline fell back
   *  to a default bid (typically Pass). */
  readonly fallbackReached?: boolean;

  // ── Parse tree ────────────────────────────────────────────────
  /** Post-bid parse tree showing the full decision chain:
   *  which conventions were considered, why each was accepted/rejected,
   *  and the path to the correct bid. */
  readonly parseTree?: ParseTreeView;

  // ── Observation history ────────────────────────────────────
  /** Viewport-safe projection of the observation log from the rule interpreter.
   *  Shows what each bid communicated in convention-erased terms (observations)
   *  and the resulting kernel state. No internal claim references leak through. */
  readonly observationHistory?: readonly ObservationStepView[];
}

// ── Observation Step View ───────────────────────────────────────────

/** Viewport-safe projection of a CommittedStep — what a bid communicated.
 *  Strips resolvedClaim (moduleId, meaningId, sourceIntent) which are
 *  implementation details the player shouldn't see. */
export interface ObservationStepView {
  /** Who made this bid. */
  readonly actor: Seat;
  /** The bid/pass/double/redouble. */
  readonly call: Call;
  /** Bridge-universal observations describing what the bid communicated.
   *  Each observation is a plain object with act + optional typed fields. */
  readonly observations: readonly ObservationView[];
  /** Kernel state after this step (negotiation state visible to both sides). */
  readonly kernel: KernelView;
  /** Whether this step was resolved to a convention surface. */
  readonly status: "resolved" | "raw-only" | "off-system";
}

/** Viewport-safe single canonical observation. */
export interface ObservationView {
  readonly act: string;
  readonly detail?: string; // Human-readable summary, e.g., "show hearts"
}

/** Viewport-safe kernel state — purely semantic negotiation state. */
export interface KernelView {
  readonly fitAgreed: { readonly strain: string; readonly confidence: string } | null;
  readonly forcing: string;
  readonly captain: string;
  readonly competition: string | { readonly kind: string; readonly strain: string; readonly level: number };
}

// ── Non-Bidding Phase Viewports ─────────────────────────────────────
//
// Seal the Deal leak for the remaining three game phases.
// Each viewport filters hands through visibility rules so components
// never receive raw Deal.

/** Viewport for the declarer prompt phase. */
export interface DeclarerPromptViewport {
  readonly userSeat: Seat;
  readonly visibleHands: Partial<Record<Seat, Hand>>;
  readonly dealer: Seat;
  readonly vulnerability: Vulnerability;
  readonly auctionEntries: readonly AuctionEntryView[];
  readonly contract: Contract;
  readonly promptMode: "defender" | "south-declarer" | "declarer-swap";
}

/** Viewport for the play phase. */
export interface PlayingViewport {
  readonly rotated: boolean;
  readonly visibleHands: Partial<Record<Seat, Hand>>;
  readonly dealer: Seat;
  readonly vulnerability: Vulnerability;
  readonly contract: Contract | null;
  readonly currentPlayer: Seat | null;
  readonly currentTrick: readonly PlayedCard[];
  readonly trumpSuit: Suit | undefined;
  readonly legalPlays: readonly Card[];
  readonly userControlledSeats: readonly Seat[];
  readonly remainingCards: Partial<Record<Seat, readonly Card[]>>;
  readonly tricks: readonly Trick[];
  readonly declarerTricksWon: number;
  readonly defenderTricksWon: number;
  readonly auctionEntries?: readonly AuctionEntryView[];
  readonly bidHistory?: readonly BidHistoryEntry[];
}

/** Viewport for the explanation/review phase. All hands are visible. */
export interface ExplanationViewport {
  readonly userSeat: Seat;
  readonly allHands: Record<Seat, Hand>;
  readonly dealer: Seat;
  readonly vulnerability: Vulnerability;
  readonly auctionEntries: readonly AuctionEntryView[];
  readonly contract: Contract | null;
  readonly score: number | null;
  readonly declarerTricksWon: number;
  readonly bidHistory: readonly BidHistoryEntry[];
}
