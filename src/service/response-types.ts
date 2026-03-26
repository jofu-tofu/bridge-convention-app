/**
 * Service response types — shapes the service returns to the client.
 *
 * Service-owned types (zero backend imports except engine vocabulary).
 * All types that cross the service boundary are defined here as explicit
 * interfaces — never re-exported from backend modules.
 *
 * ALLOWED to cross: BiddingViewport, ViewportBidFeedback, TeachingDetail,
 *   Call, Card, Seat, Vulnerability, SessionHandle, session config DTOs.
 *
 * NEVER crosses: Deal, BidResult, DrillSession, DrillBundle,
 *   ConventionStrategy, StrategyEvaluation, ArbitrationResult,
 *   BidMeaning, InferenceEngine.
 */

import type { Call, Card, Hand, Seat, Vulnerability, SuitLength, DistributionPoints, Contract, PlayedCard, Trick, Suit, DDSolution, AuctionEntry, NumberRange } from "../engine/types";

// ── Service-owned type replacements ─────────────────────────────────
//
// These types mirror their backend counterparts exactly (bidirectional
// structural compatibility). Defining them here makes the service boundary
// explicit: backend changes require a conscious mapping update, and this
// file is readable without chasing imports across 7 modules.

/** Game phase — service-owned mirror of session/phase-machine GamePhase. */
export type ServiceGamePhase =
  | "BIDDING"
  | "DECLARER_PROMPT"
  | "PLAYING"
  | "EXPLANATION";

/** Bid grade — service-owned string union (mirror of BidGrade enum values). */
export type ViewportBidGrade =
  | "correct"
  | "correct-not-preferred"
  | "acceptable"
  | "near-miss"
  | "incorrect";

/** Encoder kind — service-owned mirror of pipeline/provenance EncoderKind. */
export type ServiceEncoderKind =
  | "default-call"
  | "resolver"
  | "alternate-encoding"
  | "frontier-step"
  | "relay-map";

/** Fact operator — service-owned mirror of pipeline/meaning FactOperator. */
export type ServiceFactOperator = "gte" | "lte" | "eq" | "range" | "boolean" | "in";

// ── Service-owned teaching types ────────────────────────────────────

/** Condition role — service-owned mirror of pipeline/evidence-bundle ConditionRole. */
export type ServiceConditionRole = "semantic" | "inferential" | "pedagogical" | "routing";

/** Condition evidence — service-owned mirror of pipeline/evidence-bundle ConditionEvidence.
 *  Flattened from ConditionResult + ConditionEvidence inheritance. */
export interface ServiceConditionEvidence {
  readonly conditionId: string;
  readonly factId?: string;
  readonly satisfied: boolean;
  readonly description?: string;
  readonly observedValue?: unknown;
  readonly threshold?: unknown;
  readonly conditionRole?: ServiceConditionRole;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Explanation node — service-owned mirror of teaching-types ExplanationNode. */
export interface ServiceExplanationNode {
  readonly kind: "text" | "condition" | "call-reference" | "convention-reference";
  readonly content: string;
  readonly passed?: boolean;
  readonly explanationId?: string;
  readonly templateKey?: string;
}

/** Why-not entry — service-owned mirror of teaching-types WhyNotEntry. */
export interface ServiceWhyNotEntry {
  readonly call: Call;
  readonly grade: "near-miss" | "wrong";
  readonly explanation: readonly ServiceExplanationNode[];
  readonly eliminationStage: string;
}

/** Convention contribution — service-owned mirror of teaching-types ConventionContribution. */
export interface ServiceConventionContribution {
  readonly moduleId: string;
  readonly role: "primary" | "alternative" | "suppressed";
  readonly meaningsProposed: readonly string[];
}

/** Meaning view — service-owned mirror of teaching-types MeaningView. */
export interface ServiceMeaningView {
  readonly meaningId: string;
  readonly semanticClassId?: string;
  readonly displayLabel: string;
  readonly status: "live" | "eliminated" | "not-applicable";
  readonly eliminationReason?: string;
  readonly supportingEvidence: readonly ServiceConditionEvidence[];
}

/** Call projection — service-owned mirror of teaching-types CallProjection. */
export interface ServiceCallProjection {
  readonly call: Call;
  readonly status: "truth" | "acceptable" | "wrong";
  readonly supportingMeanings: readonly string[];
  readonly primaryMeaning?: string;
  readonly projectionKind: "single-rationale" | "merged-equivalent" | "multi-rationale-same-call";
}

/** Parse tree module verdict — service-owned mirror. */
export type ServiceParseTreeModuleVerdict = "selected" | "applicable" | "eliminated";

/** Parse tree condition — service-owned mirror of teaching-types ParseTreeCondition. */
export interface ServiceParseTreeCondition {
  readonly factId: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly observedValue?: unknown;
}

/** Parse tree module node — service-owned mirror of teaching-types ParseTreeModuleNode. */
export interface ServiceParseTreeModuleNode {
  readonly moduleId: string;
  readonly displayLabel: string;
  readonly verdict: ServiceParseTreeModuleVerdict;
  readonly conditions: readonly ServiceParseTreeCondition[];
  readonly meanings: readonly {
    readonly meaningId: string;
    readonly displayLabel: string;
    readonly matched: boolean;
    readonly call?: Call;
  }[];
  readonly eliminationReason?: string;
}

/** Parse tree view — service-owned mirror of teaching-types ParseTreeView. */
export interface ServiceParseTreeView {
  readonly modules: readonly ServiceParseTreeModuleNode[];
  readonly selectedPath: {
    readonly moduleId: string;
    readonly meaningId: string;
    readonly call: Call;
  } | null;
}

// ── Service-owned viewport-safe bid history ─────────────────────────

/** Bid history entry — viewport-safe subset of conventions/core BidHistoryEntry.
 *  Omits deep backend types (BidResult, TeachingProjection) that must not cross
 *  the service boundary. Structurally compatible in both directions because the
 *  omitted fields are all optional on the backend type. */
export interface ServiceBidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly meaning?: string;
  readonly isUser: boolean;
  readonly isCorrect?: boolean;
  readonly expectedResult?: {
    readonly call: Call;
    readonly meaning?: string;
    readonly explanation: string;
    readonly ruleName: string | null;
  };
  readonly alertLabel?: string;
  readonly annotationType?: "alert" | "announce" | "educational";
}

// ── Service-owned inference types ───────────────────────────────────

/** Fact constraint — service-owned mirror of conventions/core FactConstraint. */
export interface ServiceFactConstraint {
  readonly factId: string;
  readonly operator: ServiceFactOperator;
  readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  readonly isPublic?: boolean;
}

/** Qualitative constraint — service-owned mirror of inference/inference-types QualitativeConstraint. */
export interface ServiceQualitativeConstraint {
  readonly factId: string;
  readonly label: string;
  readonly operator: string;
  readonly value: unknown;
}

/** Derived ranges — service-owned mirror of inference/inference-types DerivedRanges. */
export interface ServiceDerivedRanges {
  readonly hcp: NumberRange;
  readonly suitLengths: Record<Suit, NumberRange>;
  readonly isBalanced: boolean | undefined;
}

/** Public beliefs — service-owned mirror of inference/inference-types PublicBeliefs. */
export interface ServicePublicBeliefs {
  readonly seat: Seat;
  readonly constraints: readonly ServiceFactConstraint[];
  readonly ranges: ServiceDerivedRanges;
  readonly qualitative: readonly ServiceQualitativeConstraint[];
}

/** Bid annotation — service-owned mirror of inference/types BidAnnotation. */
export interface ServiceBidAnnotation {
  readonly call: Call;
  readonly seat: Seat;
  readonly conventionId: string | null;
  readonly meaning: string;
  readonly constraints: readonly ServiceFactConstraint[];
}

/** Public belief state — service-owned mirror of inference/types PublicBeliefState. */
export interface ServicePublicBeliefState {
  readonly beliefs: Record<Seat, ServicePublicBeliefs>;
  readonly annotations: readonly ServiceBidAnnotation[];
}

/** Inference snapshot — service-owned mirror of inference/types InferenceSnapshot. */
export interface ServiceInferenceSnapshot {
  readonly entry: AuctionEntry;
  readonly newConstraints: readonly ServiceFactConstraint[];
  readonly cumulativeBeliefs: Record<Seat, ServicePublicBeliefs>;
}

// ── Result DTOs ─────────────────────────────────────────────────────

/** Result of starting a drill. */
export interface DrillStartResult {
  readonly viewport: BiddingViewport;
  readonly isOffConvention: boolean;
  readonly aiBids: readonly AiBidEntry[];
  /** True when the auction completed during initial AI bids (e.g., all four seats passed). */
  readonly auctionComplete: boolean;
}

/** A single AI bid entry for animation. */
export interface AiBidEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly historyEntry: ServiceBidHistoryEntry;
}

/** Result of submitting a user bid. */
export interface BidSubmitResult {
  /** False = wrong bid, retry needed. */
  readonly accepted: boolean;
  readonly feedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
  readonly grade: ViewportBidGrade | null;
  readonly aiBids: readonly AiBidEntry[];
  readonly nextViewport: BiddingViewport | null;
  readonly phaseTransition: PhaseTransition | null;
  /** History entry for the user's accepted bid (null when rejected). */
  readonly userHistoryEntry: ServiceBidHistoryEntry | null;
}

/** Phase transition notification. */
export interface PhaseTransition {
  readonly from: ServiceGamePhase;
  readonly to: ServiceGamePhase;
}

/** Result of accepting a prompt (play/skip). */
export interface PromptAcceptResult {
  readonly phase: ServiceGamePhase;
}

/** Result of playing a card. */
export interface PlayCardResult {
  readonly accepted: boolean;
  readonly trickComplete: boolean;
  readonly playComplete: boolean;
  readonly score: number | null;
  /** AI plays that followed the user's card (for animation). */
  readonly aiPlays: readonly AiPlayEntry[];
  /** Legal plays for the next user turn (null if play complete or AI's turn). */
  readonly legalPlays: readonly Card[] | null;
  /** Current player after all processing. */
  readonly currentPlayer: Seat | null;
}

/** A single AI play entry for animation (analogous to AiBidEntry). */
export interface AiPlayEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
}

/** Current session viewport. */
export interface SessionViewport {
  readonly phase: ServiceGamePhase;
  readonly biddingViewport: BiddingViewport | null;
}

/** DDS solution result. */
export interface DDSolutionResult {
  readonly solution: DDSolution | null;
  readonly error: string | null;
}

/** Convention info for catalog listing. */
export interface ConventionInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category?: string;
}

// ── Module-Centric Learning Viewport ─────────────────────────────────

/** Module catalog entry for sidebar listing. */
export interface ModuleCatalogEntry {
  readonly moduleId: string;
  readonly displayName: string;
  readonly description: string;
  readonly purpose: string;
  readonly surfaceCount: number;
  readonly bundleIds: readonly string[];
}

/** Full learning viewport for a single module. */
export interface ModuleLearningViewport {
  readonly moduleId: string;
  readonly displayName: string;
  readonly description: string;
  readonly purpose: string;
  /** Authored teaching content (orthogonal to structure, self-contained). */
  readonly teaching: {
    readonly tradeoff: string | null;
    readonly principle: string | null;
    readonly commonMistakes: readonly string[];
  };
  /** Surfaces grouped by conversation phase. */
  readonly phases: readonly PhaseGroupView[];
  readonly bundleIds: readonly string[];
}

/** Surfaces grouped by conversation phase. */
export interface PhaseGroupView {
  readonly phase: string;
  /** Human-readable, e.g., "Asked — Opener". */
  readonly phaseDisplay: string;
  readonly turn: string | null;
  readonly surfaces: readonly SurfaceDetailView[];
}

/** A single fact requirement on a learning surface. */
export interface SurfaceClauseView {
  readonly factId: string;
  readonly operator: ServiceFactOperator;
  readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  /** Human-readable description — always auto-derived, optionally with author rationale appended. */
  readonly description: string;
  /** True if this clause is disclosed to opponents (communicative). */
  readonly isPublic: boolean;
}

/** Surface detail with explanation text. */
export interface SurfaceDetailView {
  readonly meaningId: string;
  readonly teachingLabel: string;
  readonly call: Call;
  readonly callDisplay: string;
  readonly disclosure: "alert" | "announcement" | "natural" | "standard";
  readonly recommendation: "must" | "should" | "may" | "avoid" | null;
  readonly explanationText: string | null;
  readonly clauses: readonly SurfaceClauseView[];
}

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

/** Post-bid teaching data derived from the evaluation oracle. */
export interface TeachingDetail {
  // ── Correct answer context ────────────────────────────────────
  /** Hand summary for the correct bid (e.g., "4♠ 3♥ 3♦ 3♣, 15 HCP"). */
  readonly handSummary?: string;
  /** Fallback explanation when teaching projection is unavailable. */
  readonly fallbackExplanation?: string;

  // ── Teaching projection data ──────────────────────────────────
  /** Primary explanation nodes (conditions with pass/fail). */
  readonly primaryExplanation?: readonly ServiceExplanationNode[];
  /** Why-not entries for alternative bids. */
  readonly whyNot?: readonly ServiceWhyNotEntry[];
  /** Convention contributions (which modules were evaluated). */
  readonly conventionsApplied?: readonly ServiceConventionContribution[];
  /** Meaning views: all meanings with live/eliminated status. */
  readonly meaningViews?: readonly ServiceMeaningView[];
  /** Call views: how each call was projected (truth/acceptable/wrong). */
  readonly callViews?: readonly ServiceCallProjection[];

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
  readonly encoderKind?: ServiceEncoderKind;

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
  readonly parseTree?: ServiceParseTreeView;

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
  readonly userSeat: Seat;
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
  readonly bidHistory?: readonly ServiceBidHistoryEntry[];
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
  readonly bidHistory: readonly ServiceBidHistoryEntry[];
}

// ── Convention Card ──────────────────────────────────────────────────

/** Convention card summary — mirrors the physical card at the table. */
export interface ConventionCardView {
  readonly partnership: string;      // "N-S" or "E-W"
  readonly systemName: string;       // "SAYC", "2/1", "Acol"
  readonly ntRange: string;          // "15–17" or "12–14"
  readonly twoLevelForcing: string;  // "1 round" or "Game forcing"
  readonly oneNtResponse: string;    // "Non-forcing 6–10" or "Semi-forcing 6–12"
  readonly majorLength: string;      // "5-card majors" or "4-card majors"
}
