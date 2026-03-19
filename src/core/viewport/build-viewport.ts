// ── Viewport Builder ────────────────────────────────────────────────
//
// Constructs the player-safe viewport from engine state.
// This is the SINGLE function that enforces the information boundary.
// Both the Svelte UI and the CLI harness call this same function.

import { type Seat, type Vulnerability, type Call, type Hand, type Deal, type Auction } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { formatCall } from "../display/format";
import { formatHandSummary } from "../display/hand-summary";
import type { BidHistoryEntry, BidResult } from "../contracts/bidding";
import type { MeaningSurface } from "../contracts/meaning";
import type { TeachingProjection } from "../contracts/teaching-projection";
import type { TeachingResolution } from "../../teaching/teaching-resolution";
import { BidGrade } from "../../teaching/teaching-resolution";
import type { PracticalScoreBreakdown } from "../../strategy/bidding/practical-types";

// Minimal interface matching BidFeedback from stores/bidding.svelte.ts.
// Defined here to avoid importing the Svelte store in CLI context.
interface BidFeedbackLike {
  readonly grade: BidGrade;
  readonly userCall: Call;
  readonly expectedResult: BidResult | null;
  readonly teachingResolution: TeachingResolution | null;
  readonly practicalRecommendation?: { topCandidateBidName: string; topCandidateCall: Call; topScore: number; rationale: string };
  readonly teachingProjection?: TeachingProjection;
  /** Score breakdown from the practical scorer (when available). */
  readonly practicalScoreBreakdown?: PracticalScoreBreakdown;
  /** Whether the evidence bundle reported exhaustive evaluation. */
  readonly evaluationExhaustive?: boolean;
  /** Whether the evidence bundle reported fallback was reached (no surface matched). */
  readonly fallbackReached?: boolean;
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
  readonly activeSurfaces?: readonly MeaningSurface[];
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
        isAlertable: surface.prioritySpec
          ? surface.prioritySpec.conventionality === "conventional"
          : surface.priorityClass === "obligatory" ||
            surface.priorityClass === "preferredConventional" ||
            false,
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
  const correctCall = feedback.expectedResult?.call;
  const correctCallDisplay = correctCall ? formatCall(correctCall) : undefined;
  const correctBidLabel = feedback.expectedResult?.alert?.teachingLabel
    ?? feedback.expectedResult?.meaning;
  const correctBidExplanation = feedback.expectedResult?.explanation;

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
  if (feedback.teachingResolution?.acceptableBids?.length) {
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
  if (feedback.teachingResolution?.nearMissCalls?.length) {
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
    handSummary: result?.handSummary,
    fallbackExplanation: result?.explanation,

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
    encoderKind: (feedback as { encodingTrace?: { encoderKind: import("../contracts/provenance").EncoderKind } }).encodingTrace?.encoderKind,

    // Practical recommendation
    practicalRecommendation: feedback.practicalRecommendation
      ? {
          topCandidateCall: feedback.practicalRecommendation.topCandidateCall,
          rationale: feedback.practicalRecommendation.rationale,
        }
      : undefined,

    // Teaching resolution
    primaryBid: resolution?.primaryBid,
    acceptableBids: resolution?.acceptableBids?.map((ab) => ({
      call: ab.call,
      meaning: ab.meaning,
      reason: ab.reason,
      fullCredit: ab.fullCredit,
    })),
    nearMissCalls: resolution?.nearMissCalls,

    // Decision metadata (from teaching resolution)
    ambiguityScore: resolution?.ambiguityScore,
    gradingType: resolution?.gradingType,

    // Practical score breakdown
    practicalScoreBreakdown: feedback.practicalScoreBreakdown
      ? { ...feedback.practicalScoreBreakdown }
      : undefined,

    // Evaluation completeness (from evidence bundle)
    evaluationExhaustive: feedback.evaluationExhaustive,
    fallbackReached: feedback.fallbackReached,
  };
}
