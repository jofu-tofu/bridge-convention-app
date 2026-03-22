// ── Viewport Builder ────────────────────────────────────────────────
//
// Constructs the player-safe viewport from engine state.
// This is the SINGLE function that enforces the information boundary.
// Both the Svelte UI and the CLI harness call this same function.

import { type Seat, type Call, type Hand, type Deal, type Auction, type Contract, type PlayedCard, type Trick, type Card, type Suit } from "../../engine/types";
import type { AuctionContext } from "../contracts/committed-step";
import type { BidAction } from "../contracts/bid-action";
import { evaluateHand } from "../../engine/hand-evaluator";
import { formatCall } from "../display/format";
import { formatHandSummary } from "../display/hand-summary";
import type { BidHistoryEntry, BidResult } from "../contracts/bidding";
import type { BidMeaning } from "../contracts/meaning";
import { isAlertable as isAlertableFromIntent } from "../contracts/alert";
import type { TeachingProjection } from "../contracts/teaching-projection";
import type { TeachingResolution } from "../contracts/teaching-grading";
import type { BidGrade } from "../contracts/teaching-grading";
import type { PracticalScoreBreakdown } from "../contracts/recommendation";
// Minimal interface matching BidFeedback from stores/bidding.svelte.ts.
// Defined here to avoid importing the Svelte store in CLI context.
interface BidFeedbackLike {
  readonly grade: BidGrade;
  readonly userCall: Call;
  readonly expectedResult: BidResult;
  readonly teachingResolution: TeachingResolution;
  readonly practicalRecommendation: { topCandidateBidName: string; topCandidateCall: Call; topScore: number; rationale: string } | null;
  readonly teachingProjection: TeachingProjection | null;
  /** Score breakdown from the practical scorer (when available). */
  readonly practicalScoreBreakdown: PracticalScoreBreakdown | null;
  /** Viewport-safe observation history (projected from AuctionContext). */
  readonly observationHistory?: readonly ObservationStepView[];
}

import type {
  BiddingViewport,
  HandEvaluationView,
  AuctionEntryView,
  BiddingOptionView,
  ViewportBidFeedback,
  ViewportBidGrade,
  ConditionView,
  AlternativeView,
  NearMissView,
  ConventionView,
  TeachingDetail,
  ObservationStepView,
  ObservationView,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "./player-viewport";

// ── Build Bidding Viewport ──────────────────────────────────────────

export interface BuildBiddingViewportInput {
  readonly deal: Deal;
  readonly userSeat: Seat;
  readonly auction: Auction;
  readonly bidHistory: readonly BidHistoryEntry[];
  readonly legalCalls: readonly Call[];
  readonly faceUpSeats: ReadonlySet<Seat>;
  readonly conventionName: string;
  readonly isUserTurn: boolean;
  readonly currentBidder: Seat;
  /** Active meaning surfaces at the current state (system-card knowledge). */
  readonly activeSurfaces?: readonly BidMeaning[];
}

/**
 * Build a BiddingViewport from engine state.
 *
 * This is the information boundary.  The returned viewport contains
 * ONLY what a player in `userSeat` can legitimately see.
 */
export function buildBiddingViewport(input: BuildBiddingViewportInput): BiddingViewport {
  const {
    deal, userSeat, auction, bidHistory, legalCalls,
    faceUpSeats, conventionName, isUserTurn, currentBidder,
    activeSurfaces,
  } = input;

  // Player's hand only
  const hand = deal.hands[userSeat];
  const eval_ = evaluateHand(hand);
  const handEvaluation: HandEvaluationView = {
    hcp: eval_.hcp,
    shape: eval_.shape,
    isBalanced: eval_.distribution.total === 0, // Shortness 0 = balanced heuristic
    totalPoints: eval_.totalPoints,
    distributionPoints: eval_.distribution,
  };

  // Visible hands — only face-up seats
  const visibleHands: Partial<Record<Seat, Hand>> = {};
  for (const seat of faceUpSeats) {
    visibleHands[seat] = deal.hands[seat];
  }

  // Auction entries with alert annotations
  const auctionEntries: AuctionEntryView[] = [];
  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;
    const historyEntry = bidHistory[i];
    auctionEntries.push({
      seat: entry.seat,
      call: entry.call,
      callDisplay: formatCall(entry.call),
      alertLabel: historyEntry?.alertLabel,
      annotationType: historyEntry?.annotationType,
    });
  }

  // Bidding options from active surfaces (system-card knowledge)
  const biddingOptions: BiddingOptionView[] = [];
  if (activeSurfaces) {
    for (const surface of activeSurfaces) {
      const call = surface.encoding.defaultCall;
      biddingOptions.push({
        call,
        callDisplay: formatCall(call),
        teachingLabel: surface.teachingLabel,
        isAlertable: isAlertableFromIntent(surface.sourceIntent.type),
        recommendation: surface.ranking.recommendationBand as BiddingOptionView["recommendation"],
      });
    }
  }

  return {
    seat: userSeat,
    conventionName,
    hand,
    handEvaluation,
    handSummary: formatHandSummary(eval_),
    visibleHands,
    auctionEntries,
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    legalCalls,
    biddingOptions,
    isUserTurn,
    currentBidder,
  };
}

// ── Build Viewport Feedback ─────────────────────────────────────────

/**
 * Convert engine BidFeedback into a viewport-safe ViewportBidFeedback.
 *
 * Strips internal evaluation data, keeping only what a human player
 * would see in the feedback panel.
 */
export function buildViewportFeedback(feedback: BidFeedbackLike): ViewportBidFeedback {
  const grade = feedback.grade as ViewportBidGrade;
  const requiresRetry = grade === "near-miss" || grade === "incorrect";

  // Correct answer (from expected result)
  const correctCall = feedback.expectedResult.call;
  const correctCallDisplay = formatCall(correctCall);
  const correctBidLabel = feedback.expectedResult.alert?.teachingLabel
    ?? feedback.expectedResult.meaning;
  const correctBidExplanation = feedback.expectedResult.explanation;

  // Conditions from teaching projection
  let conditions: ConditionView[] | undefined;
  if (feedback.teachingProjection?.primaryExplanation) {
    conditions = feedback.teachingProjection.primaryExplanation
      .filter((n) => n.kind === "condition")
      .map((n) => ({
        description: n.content,
        passed: n.passed ?? true,
      }));
  }

  // Acceptable alternatives
  let acceptableAlternatives: AlternativeView[] | undefined;
  if (feedback.teachingResolution.acceptableBids?.length) {
    acceptableAlternatives = feedback.teachingResolution.acceptableBids.map((ab) => ({
      call: ab.call,
      callDisplay: formatCall(ab.call),
      label: ab.meaning,
      reason: ab.reason,
      fullCredit: ab.fullCredit,
    }));
  }

  // Near misses
  let nearMisses: NearMissView[] | undefined;
  if (feedback.teachingResolution.nearMissCalls?.length) {
    nearMisses = feedback.teachingResolution.nearMissCalls.map((nm) => ({
      call: nm.call,
      callDisplay: formatCall(nm.call),
      reason: nm.reason,
    }));
  }

  // Partner hand space
  let partnerHandSpace: string | undefined;
  if (feedback.teachingProjection?.handSpace?.partnerSummary) {
    partnerHandSpace = feedback.teachingProjection.handSpace.partnerSummary;
  }

  // Convention contributions
  let conventionsApplied: ConventionView[] | undefined;
  if (feedback.teachingProjection?.conventionsApplied?.length) {
    conventionsApplied = feedback.teachingProjection.conventionsApplied.map((c) => ({
      moduleId: c.moduleId,
      role: c.role,
    }));
  }

  return {
    grade,
    userCall: feedback.userCall,
    userCallDisplay: formatCall(feedback.userCall),
    correctCall,
    correctCallDisplay,
    correctBidLabel,
    correctBidExplanation,
    conditions,
    acceptableAlternatives,
    nearMisses,
    partnerHandSpace,
    conventionsApplied,
    requiresRetry,
  };
}

// ── Build Teaching Detail ───────────────────────────────────────────

/**
 * Extract the teaching detail from a BidFeedback-like object.
 *
 * This is the oracle-side teaching data, available ONLY after grading.
 * Both CLI (--json diagnostics) and UI ("Show Answer" panels) consume
 * this through the same type.
 */
export function buildTeachingDetail(feedback: BidFeedbackLike): TeachingDetail {
  const projection = feedback.teachingProjection;
  const resolution = feedback.teachingResolution;
  const result = feedback.expectedResult;

  return {
    // Correct answer context
    handSummary: result.handSummary,
    fallbackExplanation: result.explanation,

    // Teaching projection (when available)
    primaryExplanation: projection?.primaryExplanation,
    whyNot: projection?.whyNot,
    conventionsApplied: projection?.conventionsApplied,
    meaningViews: projection?.meaningViews,
    callViews: projection?.callViews,

    // Partner hand space
    partnerSummary: projection?.handSpace?.partnerSummary,
    archetypes: projection?.handSpace?.archetypes?.map((a) => ({
      label: a.label,
      hcpRange: a.hcpRange,
      shapePattern: a.shapePattern,
    })),

    // Encoding trace
    encoderKind: projection?.encoderKind,

    // Practical recommendation
    practicalRecommendation: feedback.practicalRecommendation
      ? {
          topCandidateCall: feedback.practicalRecommendation.topCandidateCall,
          rationale: feedback.practicalRecommendation.rationale,
        }
      : undefined,

    // Teaching resolution
    primaryBid: resolution.primaryBid,
    acceptableBids: resolution.acceptableBids?.map((ab) => ({
      call: ab.call,
      meaning: ab.meaning,
      reason: ab.reason,
      fullCredit: ab.fullCredit,
    })),
    nearMissCalls: resolution.nearMissCalls,

    // Decision metadata (from teaching resolution)
    ambiguityScore: resolution.ambiguityScore,
    gradingType: resolution.gradingType,

    // Practical score breakdown
    practicalScoreBreakdown: feedback.practicalScoreBreakdown
      ? { ...feedback.practicalScoreBreakdown }
      : undefined,

    // Evaluation completeness (from teaching projection)
    evaluationExhaustive: projection?.evaluationExhaustive ?? false,
    fallbackReached: projection?.fallbackReached ?? false,

    // Parse tree (from teaching projection)
    parseTree: projection?.parseTree,

    // Observation history (from AuctionContext, viewport-safe projection)
    observationHistory: feedback.observationHistory,
  };
}

// ── Observation log projection ──────────────────────────────────────

/**
 * Project an AuctionContext into a viewport-safe observation history.
 *
 * Strips `resolvedClaim` (moduleId, meaningId, sourceIntent) which are
 * implementation details. Keeps only `publicActions`, `stateAfter`, `actor`,
 * `call`, and `status` — the bridge-observable information.
 */
export function projectObservationHistory(
  ctx: AuctionContext | null | undefined,
): ObservationStepView[] | undefined {
  if (!ctx || ctx.log.length === 0) return undefined;

  return ctx.log.map((step) => ({
    actor: step.actor,
    call: step.call,
    observations: step.publicActions.map(formatObservation),
    kernel: {
      fitAgreed: step.stateAfter.fitAgreed,
      forcing: step.stateAfter.forcing,
      captain: step.stateAfter.captain,
      competition: step.stateAfter.competition,
    },
    status: step.status === "ambiguous" ? "off-system" as const : step.status,
  }));
}

/** Format a BidAction into a human-readable ObservationView. */
function formatObservation(obs: BidAction): ObservationView {
  const parts: string[] = [obs.act];
  if ("feature" in obs && obs.feature) parts.push(obs.feature);
  if ("suit" in obs && obs.suit) parts.push(obs.suit);
  if ("strain" in obs && obs.strain) parts.push(obs.strain);
  if ("targetSuit" in obs && obs.targetSuit) parts.push(obs.targetSuit);
  if ("strength" in obs && obs.strength) parts.push(obs.strength);
  if ("quality" in obs && obs.quality) parts.push(String(obs.quality));
  return { act: obs.act, detail: parts.join("(") + (parts.length > 1 ? ")" : "") };
}

// ── Shared helpers ──────────────────────────────────────────────────

/** Build viewport-safe auction entries from raw auction + bid history. */
function buildAuctionEntries(
  auction: Auction,
  bidHistory: readonly BidHistoryEntry[],
): AuctionEntryView[] {
  const entries: AuctionEntryView[] = [];
  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;
    const historyEntry = bidHistory[i];
    entries.push({
      seat: entry.seat,
      call: entry.call,
      callDisplay: formatCall(entry.call),
      alertLabel: historyEntry?.alertLabel,
      annotationType: historyEntry?.annotationType,
    });
  }
  return entries;
}

/** Filter hands through faceUpSeats, returning only visible ones. */
function filterVisibleHands(
  deal: Deal,
  faceUpSeats: ReadonlySet<Seat>,
): Partial<Record<Seat, Hand>> {
  const visible: Partial<Record<Seat, Hand>> = {};
  for (const seat of faceUpSeats) {
    visible[seat] = deal.hands[seat];
  }
  return visible;
}

// ── Build Declarer Prompt Viewport ──────────────────────────────────

export interface BuildDeclarerPromptViewportInput {
  readonly deal: Deal;
  readonly userSeat: Seat;
  readonly faceUpSeats: ReadonlySet<Seat>;
  readonly auction: Auction;
  readonly bidHistory: readonly BidHistoryEntry[];
  readonly contract: Contract;
  readonly promptMode: "defender" | "south-declarer" | "declarer-swap";
}

/**
 * Build a DeclarerPromptViewport from engine state.
 *
 * Filters hands through faceUpSeats so the component never sees
 * cards the player shouldn't know about.
 */
export function buildDeclarerPromptViewport(
  input: BuildDeclarerPromptViewportInput,
): DeclarerPromptViewport {
  const { deal, userSeat, faceUpSeats, auction, bidHistory, contract, promptMode } = input;

  return {
    userSeat,
    visibleHands: filterVisibleHands(deal, faceUpSeats),
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    auctionEntries: buildAuctionEntries(auction, bidHistory),
    contract,
    promptMode,
  };
}

// ── Build Playing Viewport ──────────────────────────────────────────

export interface BuildPlayingViewportInput {
  readonly deal: Deal;
  readonly faceUpSeats: ReadonlySet<Seat>;
  readonly auction?: Auction;
  readonly bidHistory?: readonly BidHistoryEntry[];
  readonly rotated: boolean;
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
}

/**
 * Build a PlayingViewport from engine state.
 *
 * Filters hands through faceUpSeats.  During play, typically the
 * user's hand + dummy are visible.
 */
export function buildPlayingViewport(
  input: BuildPlayingViewportInput,
): PlayingViewport {
  const {
    deal, faceUpSeats, auction, bidHistory, rotated, contract,
    currentPlayer, currentTrick, trumpSuit, legalPlays,
    userControlledSeats, remainingCards, tricks,
    declarerTricksWon, defenderTricksWon,
  } = input;

  return {
    rotated,
    visibleHands: filterVisibleHands(deal, faceUpSeats),
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    contract,
    currentPlayer,
    currentTrick,
    trumpSuit,
    legalPlays,
    userControlledSeats,
    remainingCards,
    tricks,
    declarerTricksWon,
    defenderTricksWon,
    auctionEntries: auction ? buildAuctionEntries(auction, bidHistory ?? []) : undefined,
    bidHistory,
  };
}

// ── Build Explanation Viewport ──────────────────────────────────────

export interface BuildExplanationViewportInput {
  readonly deal: Deal;
  readonly userSeat: Seat;
  readonly auction: Auction;
  readonly bidHistory: readonly BidHistoryEntry[];
  readonly contract: Contract | null;
  readonly score: number | null;
  readonly declarerTricksWon: number;
}

/**
 * Build an ExplanationViewport from engine state.
 *
 * All four hands are exposed — this is the review phase where
 * everything is visible.
 */
export function buildExplanationViewport(
  input: BuildExplanationViewportInput,
): ExplanationViewport {
  const { deal, userSeat, auction, bidHistory, contract, score, declarerTricksWon } = input;

  return {
    userSeat,
    allHands: deal.hands,
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    auctionEntries: buildAuctionEntries(auction, bidHistory),
    contract,
    score,
    declarerTricksWon,
    bidHistory,
  };
}
