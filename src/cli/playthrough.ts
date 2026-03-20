// ── Playthrough infrastructure ──────────────────────────────────────
//
// Shared types and functions for running full auction playthroughs.
// Used by the play, plan, and (future) integration-test commands.

import {
  replay,
  getBaseModules,
} from "../conventions/core";
import { createSpecStrategy, createOpponentStrategy } from "../bootstrap/strategy-factory";
import { assembleBidFeedback, BidGrade } from "../bootstrap/bid-feedback-builder";
import type { BidResult } from "../core/contracts/bidding";
import { buildViewportFeedback, buildTeachingDetail } from "../core/viewport/build-viewport";

import type { ConventionSpec, BiddingSystem, Auction, Call, OpponentMode, Seat, BiddingViewport, Deal } from "./shared";
import { Vulnerability,
  callKey,
  generateSeededDeal, resolveUserSeat, buildInitialAuction, buildContext, nextSeatClockwise, partnerOf, buildCliViewport,
} from "./shared";

// ── Types ───────────────────────────────────────────────────────────

/** Internal tracking data for each convention-player decision point.
 *  Carries both player-visible data (via BiddingViewport) and internal
 *  metadata (stateId, atomId, recommendation) for plan/selftest use. */
export interface PlaythroughStep {
  readonly stepIndex: number;
  /** Convention state metadata (internal — not exposed to agents). */
  readonly stateId: string | null;
  readonly atomId: string | null;
  readonly meaningLabel: string | null;
  readonly recommendation: string;
  readonly isUserStep: boolean;
  /** Context needed to rebuild the viewport on demand. */
  readonly seat: Seat;
  readonly auctionEntries: readonly { seat: Seat; call: Call }[];
}

export interface PlaythroughResult {
  readonly seed: number;
  readonly deal: Deal;
  readonly userSeat: Seat;
  readonly bundleName: string;
  readonly steps: readonly PlaythroughStep[];
  readonly atomsCovered: readonly string[];
}

// ── Atom call map ───────────────────────────────────────────────────

/**
 * Build a map from (stateId, callKey) → atom info.
 * Used to identify which atom a strategy recommendation corresponds to.
 */
export function buildAtomCallMap(
  spec: ConventionSpec,
): Map<string, { atomId: string; meaningLabel: string }> {
  const map = new Map<string, { atomId: string; meaningLabel: string }>();
  for (const track of getBaseModules(spec)) {
    for (const [stateId, state] of Object.entries(track.states)) {
      if (!state.surface) continue;
      const fragment = spec.surfaces[state.surface];
      if (!fragment) continue;
      for (const surface of fragment.surfaces) {
        const call = surface.encoding?.defaultCall;
        if (call) {
          const key = `${stateId}|${callKey(call)}`;
          map.set(key, {
            atomId: `${stateId}/${state.surface}/${surface.meaningId}`,
            meaningLabel: surface.teachingLabel,
          });
        }
      }
    }
  }
  return map;
}

// ── Single playthrough ──────────────────────────────────────────────

/**
 * Run a single playthrough: generate a deal, let the strategy drive
 * the auction naturally, and record each decision point.
 */
export function runSinglePlaythrough(
  system: BiddingSystem,
  spec: ConventionSpec,
  seed: number,
  atomCallMap: Map<string, { atomId: string; meaningLabel: string }>,
  vulnerability: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "natural",
): PlaythroughResult {
  const deal = generateSeededDeal(system, seed, vulnerability);
  const userSeat = resolveUserSeat(system, deal);
  const partner = partnerOf(userSeat);
  const strategy = createSpecStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createOpponentStrategy("natural")
    : null;

  const initAuction = buildInitialAuction(system, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];

  const steps: PlaythroughStep[] = [];
  const atomsCovered: string[] = [];
  const maxIter = 30; // safety limit

  for (let iter = 0; iter < maxIter; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponent turn
    if (activeSeat !== userSeat && activeSeat !== partner) {
      let opponentCall: Call = { type: "pass" };
      if (ewStrategy) {
        const hand = deal.hands[activeSeat];
        const auction: Auction = { entries: [...entries], isComplete: false };
        const ctx = buildContext(hand, auction, activeSeat, vulnerability);
        const ewResult = ewStrategy.suggest(ctx);
        if (ewResult) opponentCall = ewResult.call;
      }
      entries.push({ seat: activeSeat, call: opponentCall });
      // Check 3 consecutive passes after a bid → auction complete
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) break;
      }
      continue;
    }

    // Convention player's turn
    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat, vulnerability);
    const result = strategy.suggest(context);

    if (!result) break; // Strategy done

    // Replay to find current state
    const snapshot = replay(
      entries.map((e) => ({ call: e.call, seat: e.seat })),
      spec,
      userSeat,
    );
    const stateId = snapshot.base?.stateId ?? null;

    // Map recommendation to atom
    let atomId: string | null = null;
    let meaningLabel: string | null = null;
    if (stateId) {
      const match = atomCallMap.get(`${stateId}|${callKey(result.call)}`);
      if (match) {
        atomId = match.atomId;
        meaningLabel = match.meaningLabel;
        atomsCovered.push(atomId);
      }
    }

    steps.push({
      stepIndex: steps.length,
      seat: activeSeat,
      stateId,
      atomId,
      meaningLabel,
      auctionEntries: [...entries],
      recommendation: callKey(result.call),
      isUserStep: activeSeat === userSeat || activeSeat === partner,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, deal, userSeat, bundleName: system.name, steps, atomsCovered };
}

// ── Step viewport ───────────────────────────────────────────────────

/**
 * Build a proper BiddingViewport for a playthrough step.
 * Uses the same buildBiddingViewport() as the UI — same information boundary.
 */
export function buildStepViewport(
  s: PlaythroughStep,
  result: PlaythroughResult,
  spec: ConventionSpec,
  vulnerability: Vulnerability = Vulnerability.None,
): BiddingViewport {
  const strategy = createSpecStrategy(spec);
  const auction: Auction = { entries: [...s.auctionEntries], isComplete: false };
  return buildCliViewport({
    deal: result.deal,
    auction,
    userSeat: result.userSeat,
    activeSeat: s.seat,
    strategy,
    bundleName: result.bundleName,
    vulnerability,
  });
}

/**
 * Build a reveal-mode step object with internal metadata.
 * Only used by `play --reveal` — includes recommendation and atom IDs.
 */
export function buildRevealStep(
  s: PlaythroughStep,
): Record<string, unknown> {
  return {
    stepIndex: s.stepIndex,
    seat: s.seat,
    stateId: s.stateId,
    atomId: s.atomId,
    meaningLabel: s.meaningLabel,
    auctionSoFar: s.auctionEntries.map((e) => ({ seat: e.seat, call: callKey(e.call) })),
    recommendation: s.recommendation,
    isUserStep: s.isUserStep,
  };
}

// ── Grading ─────────────────────────────────────────────────────────

export function gradePlaythroughStep(
  s: PlaythroughStep,
  submittedCall: Call,
  spec: ConventionSpec,
  system: BiddingSystem,
  seed: number,
  vulnerability: Vulnerability = Vulnerability.None,
): { viewportFeedback: ReturnType<typeof buildViewportFeedback>; teachingDetail: ReturnType<typeof buildTeachingDetail>; isCorrect: boolean; isAcceptable: boolean } {
  // Rebuild context for this step to get full teaching feedback
  const deal = generateSeededDeal(system, seed, vulnerability);
  const activeSeat = s.seat;
  const hand = deal.hands[activeSeat];
  const auction: Auction = { entries: [...s.auctionEntries], isComplete: false };
  const context = buildContext(hand, auction, activeSeat, vulnerability);

  const strategy = createSpecStrategy(spec);
  const result = strategy.suggest(context);

  if (!result) {
    const fallbackResult: BidResult = {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No convention bid applies",
    };
    const fallbackFeedback = assembleBidFeedback(submittedCall, fallbackResult, null);
    return {
      viewportFeedback: buildViewportFeedback(fallbackFeedback),
      teachingDetail: buildTeachingDetail(fallbackFeedback),
      isCorrect: false,
      isAcceptable: false,
    };
  }

  const strategyEval = (strategy).getLastEvaluation?.() ?? null;
  const bidFeedback = assembleBidFeedback(submittedCall, result, strategyEval);

  return {
    viewportFeedback: buildViewportFeedback(bidFeedback),
    teachingDetail: buildTeachingDetail(bidFeedback),
    isCorrect: bidFeedback.grade === BidGrade.Correct || bidFeedback.grade === BidGrade.CorrectNotPreferred,
    isAcceptable: bidFeedback.grade === BidGrade.Acceptable,
  };
}
