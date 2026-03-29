/**
 * Bidding controller — pure logic extracted from bidding.svelte.ts.
 *
 * No Svelte dependencies. No $state. No tick(). No delays.
 * The service runs the full bid cycle and returns a final snapshot
 * plus an aiBids list. The store owns animation timing.
 */

import type { Call, Auction, Seat } from "../engine/types";

import type { BidResult, BidHistoryEntry } from "../conventions";
import { BidGrade } from "../conventions";
import { nextSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions";
import { assembleBidFeedback } from "./bid-feedback-builder";
import type { BidFeedbackDTO } from "./bid-feedback-builder";
import type { EnginePort } from "../engine/port";
import { getCurrentTurn, type SessionState } from "./session-state";
import type { AiBidEntry } from "../service/response-types";
import { PlayPreference } from "./drill-types";
import type { GamePhase } from "./phase-machine";
import { isValidTransition } from "./phase-machine";
import { buildViewportFeedback, buildTeachingDetail } from "./build-viewport";
import type { ViewportBidFeedback, TeachingDetail } from "../service/response-types";
import type { ViewportBidGrade } from "../service/response-types";

/** Result of processing a user bid — returned by processBid(). */
interface BidProcessResult {
  readonly accepted: boolean;
  readonly feedback: BidFeedbackDTO | null;
  readonly viewportFeedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
  readonly grade: ViewportBidGrade | null;
  readonly aiBids: readonly AiBidEntry[];
  readonly auctionComplete: boolean;
  readonly phaseTransition: { from: GamePhase; to: GamePhase } | null;
  /** History entry for the user's accepted bid (null when rejected). */
  readonly userHistoryEntry: BidHistoryEntry | null;
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
    return applyBidAndRunAi(state, currentTurn, call, null, engine, null);
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

  // Grade-acceptance policy: Correct/CorrectNotPreferred/Acceptable advance;
  // NearMiss/Incorrect block and require retry.
  const shouldReject = feedback.grade === BidGrade.NearMiss || feedback.grade === BidGrade.Incorrect;

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

  if (shouldReject) {
    const viewportFeedback = buildViewportFeedback(feedback);
    const teaching = buildTeachingDetail(feedback);
    return {
      accepted: false,
      feedback,
      viewportFeedback,
      teaching,
      grade: `${feedback.grade}` as unknown as ViewportBidGrade,
      aiBids: [],
      auctionComplete: false,
      phaseTransition: null,
      userHistoryEntry: null,
    };
  }

  return applyBidAndRunAi(state, currentTurn, call, effectiveResult, engine, feedback);
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

  // If it's already the user's turn, fetch legal calls and push pre-bid snapshot
  if (state.isUserSeat(currentTurn)) {
    state.legalCalls = await engine.getLegalCalls(state.auction, currentTurn);
    pushPreBidSnapshot(state);
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
  state.bidHistory = initialAuction.entries.map((entry, i) => {
    const auctionSoFar: Auction = {
      entries: initialAuction.entries.slice(0, i),
      isComplete: false,
    };
    const hand = state.deal.hands[entry.seat];
    const result = state.session.getNextBid(entry.seat, hand, auctionSoFar);

    // Strategy should always agree — deal constraints guarantee valid bids.
    // Warn as canary for bugs in deal generation.
    const matches = result && callEquals(result.call, entry.call);
    if (result && !matches) {
      console.warn(`initializeAuction: strategy disagreed at index ${i}`);
    }
    return {
      seat: entry.seat,
      call: entry.call,
      isUser: false,
      meaning: matches ? result.meaning : undefined,
      alertLabel: matches ? result.alert?.teachingLabel : undefined,
      annotationType: matches ? result.alert?.annotationType : undefined,
      publicConditions: matches ? result.publicConditions : undefined,
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

/** Compare two Call values for equality. */
function callEquals(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") return a.level === b.level && a.strain === b.strain;
  return true; // both special calls with same type
}

// ── Internal helpers ────────────────────────────────────────────────

/** Apply user's bid, run AI bids, and return result. */
async function applyBidAndRunAi(
  state: SessionState,
  seat: Seat,
  call: Call,
  expectedResult: BidResult | null,
  engine: EnginePort,
  // IMPORTANT: feedback must be pre-computed before AI bids run.
  // After runAiBidLoop(), strategy.getLastEvaluation() returns the last
  // AI bid's evaluation, not the user's — so re-evaluating here would
  // produce incorrect grades for non-Correct accepted bids.
  preFeedback: BidFeedbackDTO | null,
): Promise<BidProcessResult> {
  // Apply user's bid to auction
  const userBidEntry = { seat, call };
  const auctionBefore = state.auction;
  const newAuction = await engine.addCall(state.auction, userBidEntry);
  state.auction = newAuction;

  // Process through inference
  state.processBid(userBidEntry, auctionBefore, expectedResult);

  // Add to bid history
  const userHistoryEntry: BidHistoryEntry = {
    seat,
    call,
    meaning: expectedResult?.meaning,
    isUser: true,
    isCorrect: expectedResult ? true : undefined,
    alertLabel: expectedResult?.alert?.teachingLabel,
    annotationType: expectedResult?.alert?.annotationType,
    publicConditions: expectedResult?.publicConditions,
    teachingProjection: state.strategy?.getLastEvaluation()?.teachingProjection ?? undefined,
  };
  state.bidHistory = [...state.bidHistory, userHistoryEntry];

  // Check if auction is complete
  const complete = await engine.isAuctionComplete(newAuction);
  if (complete) {
    return handleAuctionComplete(state, engine, userHistoryEntry, preFeedback);
  }

  // Run AI bids
  const nextTurn = nextSeat(seat);
  const aiResult = await runAiBidLoop(state, nextTurn, engine);

  // Use pre-computed feedback — getLastEvaluation() is stale after AI bids
  let viewportFeedback: ViewportBidFeedback | null = null;
  let teaching: TeachingDetail | null = null;
  let grade: ViewportBidGrade | null = null;
  if (preFeedback) {
    viewportFeedback = buildViewportFeedback(preFeedback);
    teaching = buildTeachingDetail(preFeedback);
    grade = `${preFeedback.grade}` as unknown as ViewportBidGrade;
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
    userHistoryEntry,
  };
}

/** Handle auction completion — get contract, transition phase. */
async function handleAuctionComplete(
  state: SessionState,
  engine: EnginePort,
  userHistoryEntry: BidHistoryEntry,
  preFeedback: BidFeedbackDTO | null,
): Promise<BidProcessResult> {
  state.capturePlayInferences();
  const contract = await engine.getContract(state.auction);
  state.contract = contract;

  if (contract) {
    state.effectiveUserSeat = state.userSeat;
    const pref = state.playPreference;
    if (pref === PlayPreference.Skip) {
      if (isValidTransition(state.phase, "EXPLANATION")) state.phase = "EXPLANATION";
    } else if (pref === PlayPreference.Always) {
      state.initializePlay(contract);
      if (isValidTransition(state.phase, "PLAYING")) state.phase = "PLAYING";
    } else {
      if (isValidTransition(state.phase, "DECLARER_PROMPT")) state.phase = "DECLARER_PROMPT";
    }
  } else {
    if (isValidTransition(state.phase, "EXPLANATION")) {
      state.phase = "EXPLANATION";
    }
  }

  return {
    accepted: true,
    feedback: null,
    viewportFeedback: preFeedback ? buildViewportFeedback(preFeedback) : null,
    teaching: preFeedback ? buildTeachingDetail(preFeedback) : null,
    grade: preFeedback ? `${preFeedback.grade}` as unknown as ViewportBidGrade : null,
    aiBids: [],
    auctionComplete: true,
    phaseTransition: { from: "BIDDING", to: state.phase },
    userHistoryEntry,
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
    } catch (err) {
      console.error(`AI bid failed for seat ${currentSeat}:`, err);
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
      publicConditions: result.publicConditions,
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
        const pref = state.playPreference;
        if (pref === PlayPreference.Skip) {
          if (isValidTransition(state.phase, "EXPLANATION")) state.phase = "EXPLANATION";
        } else if (pref === PlayPreference.Always) {
          state.initializePlay(contract);
          if (isValidTransition(state.phase, "PLAYING")) state.phase = "PLAYING";
        } else {
          if (isValidTransition(state.phase, "DECLARER_PROMPT")) state.phase = "DECLARER_PROMPT";
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
    pushPreBidSnapshot(state);
  }

  return { aiBids, auctionComplete: false };
}

/**
 * Push a "pre-bid" debug snapshot when it becomes the user's turn.
 * This lets the debug drawer show the expected bid and pipeline state
 * before the user acts — on initial load and after each AI bid cycle.
 */
function pushPreBidSnapshot(state: SessionState): void {
  if (!state.strategy) return;
  const currentTurn = getCurrentTurn(state);
  if (!currentTurn || !state.isUserSeat(currentTurn)) return;

  const hand = state.deal.hands[currentTurn];
  const evaluation = evaluateHand(hand);
  const expectedResult = state.strategy.suggest(
    createBiddingContext({ hand, auction: state.auction, seat: currentTurn, evaluation }),
  );

  const effectiveResult: BidResult = expectedResult ?? {
    call: { type: "pass" },
    ruleName: null,
    explanation: "No convention bid applies — pass",
  };

  const snap = state.captureSnapshot();
  state.pushDebugLog({
    kind: "pre-bid",
    turnIndex: state.debugTurnCounter,
    seat: currentTurn,
    snapshot: { ...snap, expectedBid: effectiveResult },
    feedback: null,
  });
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
    userHistoryEntry: null,
  };
}
