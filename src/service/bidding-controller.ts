/**
 * Bidding controller — pure logic extracted from bidding.svelte.ts.
 *
 * No Svelte dependencies. No $state. No tick(). No delays.
 * The service runs the full bid cycle and returns a final snapshot
 * plus an aiBids list. The store owns animation timing.
 */

import type { Call, Auction, Seat } from "../engine/types";
import { BidSuit } from "../engine/types";
import type { BidResult, BidHistoryEntry } from "../core/contracts";
import { BidGrade } from "../core/contracts/teaching-grading";
import { nextSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions/core";
import { assembleBidFeedback } from "../bootstrap/bid-feedback-builder";
import type { BidFeedbackDTO } from "../bootstrap/bid-feedback-builder";
import type { EnginePort } from "../engine/port";
import type { SessionState } from "./session-state";
import type { AiBidEntry } from "./response-types";
import type { GamePhase } from "../stores/phase-machine";
import { isValidTransition } from "../stores/phase-machine";
import { buildViewportFeedback, buildTeachingDetail } from "../core/viewport";
import type { ViewportBidFeedback, TeachingDetail } from "../core/viewport";
import type { ViewportBidGrade } from "../core/viewport/player-viewport";

/** Result of processing a user bid — returned by processBid(). */
export interface BidProcessResult {
  readonly accepted: boolean;
  readonly feedback: BidFeedbackDTO | null;
  readonly viewportFeedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
  readonly grade: ViewportBidGrade | null;
  readonly aiBids: readonly AiBidEntry[];
  readonly auctionComplete: boolean;
  readonly phaseTransition: { from: GamePhase; to: GamePhase } | null;
}

/**
 * Process a user's bid: grade, apply if correct, run AI bids, return result.
 *
 * This is the atomic equivalent of userBidImpl() + applyBidAndContinue() + runAiBids()
 * from bidding.svelte.ts, but without any Svelte reactivity or delays.
 */
export async function processBid(
  state: SessionState,
  call: Call,
  engine: EnginePort,
): Promise<BidProcessResult> {
  const { session, deal, strategy } = state;
  const currentTurn = getCurrentTurn(state);

  if (!currentTurn || !session.isUserSeat(currentTurn)) {
    return emptyResult();
  }

  // No convention strategy — no correctness checking, let any bid through
  if (!strategy) {
    return applyBidAndRunAi(state, currentTurn, call, null, engine);
  }

  // Grade the bid
  const hand = deal.hands[currentTurn];
  const evaluation = evaluateHand(hand);
  const expectedResult = strategy.suggest(
    createBiddingContext({ hand, auction: state.auction, seat: currentTurn, evaluation }),
  );

  // Convention exhausted → expected bid is Pass
  const effectiveResult: BidResult = expectedResult ?? {
    call: { type: "pass" },
    ruleName: null,
    explanation: "No convention bid applies — pass",
  };

  const strategyEval = strategy.getLastEvaluation();
  const feedback = assembleBidFeedback(call, effectiveResult, strategyEval);
  const isCorrect = feedback.grade === BidGrade.Correct;

  // Capture debug log entry
  const snap = state.captureSnapshot();
  state.pushDebugLog({
    kind: "user-bid",
    turnIndex: state.debugTurnCounter++,
    seat: currentTurn,
    call,
    snapshot: { ...snap, expectedBid: effectiveResult },
    feedback,
  });

  // Correct-path-only: wrong bids are never applied to the auction
  if (!isCorrect) {
    state.currentFeedback = feedback;
    const viewportFeedback = buildViewportFeedback(feedback);
    const teaching = buildTeachingDetail(feedback);
    return {
      accepted: false,
      feedback,
      viewportFeedback,
      teaching,
      grade: `${feedback.grade}` as ViewportBidGrade,
      aiBids: [],
      auctionComplete: false,
      phaseTransition: null,
    };
  }

  return applyBidAndRunAi(state, currentTurn, call, effectiveResult, engine);
}

/**
 * Run initial AI bids after drill start (before user's first turn).
 * Returns the list of AI bids for animation.
 */
export async function runInitialAiBids(
  state: SessionState,
  engine: EnginePort,
): Promise<{ aiBids: AiBidEntry[]; auctionComplete: boolean }> {
  const currentTurn = getCurrentTurn(state);
  if (!currentTurn) return { aiBids: [], auctionComplete: false };

  // If it's already the user's turn, fetch legal calls and return
  if (state.isUserSeat(currentTurn)) {
    state.legalCalls = await engine.getLegalCalls(state.auction, currentTurn);
    return { aiBids: [], auctionComplete: false };
  }

  return runAiBidLoop(state, currentTurn, engine);
}

/**
 * Initialize auction from an initial auction (pre-set bids).
 * Replays entries into bid history and inference.
 */
export function initializeAuction(
  state: SessionState,
  initialAuction: Auction,
): void {
  state.auction = initialAuction;
  state.bidHistory = initialAuction.entries.map((entry) => {
    const is1NT = entry.call.type === "bid" &&
      entry.call.level === 1 &&
      entry.call.strain === BidSuit.NoTrump;
    return {
      seat: entry.seat,
      call: entry.call,
      isUser: false,
      alertLabel: is1NT ? "15 to 17" : undefined,
      annotationType: is1NT ? "announce" as const : undefined,
    };
  });

  // Replay initial auction through inference
  for (let i = 0; i < initialAuction.entries.length; i++) {
    const entry = initialAuction.entries[i]!;
    const auctionBefore: Auction = {
      entries: initialAuction.entries.slice(0, i),
      isComplete: false,
    };
    state.processBid(entry, auctionBefore, null);
  }
}

// ── Internal helpers ────────────────────────────────────────────────

/** Get the current turn seat from the auction. */
function getCurrentTurn(state: SessionState): Seat | null {
  if (state.auction.entries.length === 0) {
    return state.deal.dealer;
  }
  const lastEntry = state.auction.entries[state.auction.entries.length - 1]!;
  return nextSeat(lastEntry.seat);
}

/** Apply user's bid, run AI bids, and return result. */
async function applyBidAndRunAi(
  state: SessionState,
  seat: Seat,
  call: Call,
  expectedResult: BidResult | null,
  engine: EnginePort,
): Promise<BidProcessResult> {
  // Apply user's bid to auction
  const userBidEntry = { seat, call };
  const auctionBefore = state.auction;
  const newAuction = await engine.addCall(state.auction, userBidEntry);
  state.auction = newAuction;

  // Process through inference
  state.processBid(userBidEntry, auctionBefore, expectedResult);

  // Add to bid history
  state.bidHistory = [
    ...state.bidHistory,
    {
      seat,
      call,
      meaning: expectedResult?.meaning,
      isUser: true,
      isCorrect: expectedResult ? true : undefined,
      alertLabel: expectedResult?.alert?.teachingLabel,
      annotationType: expectedResult?.alert?.annotationType,
      teachingProjection: state.strategy?.getLastEvaluation()?.teachingProjection ?? undefined,
    },
  ];

  // Check if auction is complete
  const complete = await engine.isAuctionComplete(newAuction);
  if (complete) {
    return handleAuctionComplete(state, engine);
  }

  // Run AI bids
  const nextTurn = nextSeat(seat);
  const aiResult = await runAiBidLoop(state, nextTurn, engine);

  // Clear feedback after successful bid + AI bids
  state.currentFeedback = null;

  // Build viewport feedback for correct bid
  let viewportFeedback: ViewportBidFeedback | null = null;
  let teaching: TeachingDetail | null = null;
  let grade: ViewportBidGrade | null = null;
  if (expectedResult) {
    const strategyEval = state.strategy?.getLastEvaluation() ?? null;
    const feedback = assembleBidFeedback(call, expectedResult, strategyEval);
    viewportFeedback = buildViewportFeedback(feedback);
    teaching = buildTeachingDetail(feedback);
    grade = `${feedback.grade}`;
  }

  return {
    accepted: true,
    feedback: null,
    viewportFeedback,
    teaching,
    grade,
    aiBids: aiResult.aiBids,
    auctionComplete: aiResult.auctionComplete,
    phaseTransition: aiResult.auctionComplete
      ? { from: "BIDDING" as GamePhase, to: state.phase }
      : null,
  };
}

/** Handle auction completion — get contract, transition phase. */
async function handleAuctionComplete(
  state: SessionState,
  engine: EnginePort,
): Promise<BidProcessResult> {
  state.capturePlayInferences();
  const contract = await engine.getContract(state.auction);
  state.contract = contract;
  state.currentFeedback = null;

  if (contract) {
    state.effectiveUserSeat = state.userSeat;
    if (isValidTransition(state.phase, "DECLARER_PROMPT")) {
      state.phase = "DECLARER_PROMPT";
    }
  } else {
    if (isValidTransition(state.phase, "EXPLANATION")) {
      state.phase = "EXPLANATION";
    }
  }

  return {
    accepted: true,
    feedback: null,
    viewportFeedback: null,
    teaching: null,
    grade: null,
    aiBids: [],
    auctionComplete: true,
    phaseTransition: { from: "BIDDING", to: state.phase },
  };
}

/** Run AI bid loop from a given seat until user's turn or auction completion. */
async function runAiBidLoop(
  state: SessionState,
  startSeat: Seat,
  engine: EnginePort,
): Promise<{ aiBids: AiBidEntry[]; auctionComplete: boolean }> {
  const aiBids: AiBidEntry[] = [];
  let currentSeat = startSeat;

  while (!state.isUserSeat(currentSeat)) {
    const hand = state.deal.hands[currentSeat];
    const result = state.session.getNextBid(currentSeat, hand, state.auction);

    if (!result) break;

    const bidEntry = { seat: currentSeat, call: result.call };
    const auctionBefore = state.auction;
    let newAuction: Auction;
    try {
      newAuction = await engine.addCall(state.auction, bidEntry);
    } catch {
      break;
    }
    state.auction = newAuction;

    state.processBid(bidEntry, auctionBefore, result);

    const historyEntry: BidHistoryEntry = {
      seat: currentSeat,
      call: result.call,
      meaning: result.meaning,
      isUser: false,
      alertLabel: result.alert?.teachingLabel,
      annotationType: result.alert?.annotationType,
    };
    state.bidHistory = [...state.bidHistory, historyEntry];
    aiBids.push({ seat: currentSeat, call: result.call, historyEntry });

    currentSeat = nextSeat(currentSeat);

    const complete = await engine.isAuctionComplete(newAuction);
    if (complete) {
      // Handle auction completion
      state.capturePlayInferences();
      const contract = await engine.getContract(state.auction);
      state.contract = contract;
      if (contract) {
        state.effectiveUserSeat = state.userSeat;
        if (isValidTransition(state.phase, "DECLARER_PROMPT")) {
          state.phase = "DECLARER_PROMPT";
        }
      } else {
        if (isValidTransition(state.phase, "EXPLANATION")) {
          state.phase = "EXPLANATION";
        }
      }
      return { aiBids, auctionComplete: true };
    }
  }

  // Fetch legal calls for user's turn
  if (state.isUserSeat(currentSeat)) {
    state.legalCalls = await engine.getLegalCalls(state.auction, currentSeat);
  }

  return { aiBids, auctionComplete: false };
}

function emptyResult(): BidProcessResult {
  return {
    accepted: false,
    feedback: null,
    viewportFeedback: null,
    teaching: null,
    grade: null,
    aiBids: [],
    auctionComplete: false,
    phaseTransition: null,
  };
}
