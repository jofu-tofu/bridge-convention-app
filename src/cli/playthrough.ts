// ── Playthrough infrastructure ──────────────────────────────────────
//
// Shared types and functions for running full auction playthroughs.
// Used by the play, plan, and (future) integration-test commands.

import {
  enumerateRuleAtoms,
} from "../conventions/core";
import type { RuleModule } from "../conventions/core";
import { createSpecStrategy, createOpponentStrategy } from "../bootstrap/strategy-factory";
import { assembleBidFeedback, BidGrade } from "../bootstrap/bid-feedback-builder";
import type { BidResult } from "../core/contracts/bidding";
import { buildViewportFeedback, buildTeachingDetail } from "../core/viewport/build-viewport";

import type { ConventionSpec, ConventionBundle, Auction, Call, OpponentMode, Seat, BiddingViewport, Deal } from "./shared";
import { Vulnerability,
  callKey,
  generateSeededDeal, resolveUserSeat, buildInitialAuction, buildContext, nextSeatClockwise, partnerOf, buildCliViewport,
} from "./shared";

// ── Types ───────────────────────────────────────────────────────────

/** Internal tracking data for each convention-player decision point.
 *  Carries both player-visible data (via BiddingViewport) and internal
 *  metadata (atomId, recommendation) for plan/selftest use. */
export interface PlaythroughStep {
  readonly stepIndex: number;
  /** Atom ID from rule enumeration (internal — not exposed to agents). */
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
 * Build a map from callKey → atom info using rule module claims.
 * Used to identify which atom a strategy recommendation corresponds to.
 *
 * Key format: just callKey (e.g. "2C", "3NT") — atoms are identified
 * by their encoding call, not by FSM state.
 */
export function buildAtomCallMap(
  ruleModules: readonly RuleModule[],
): Map<string, { atomId: string; meaningLabel: string }> {
  const map = new Map<string, { atomId: string; meaningLabel: string }>();
  const atoms = enumerateRuleAtoms(ruleModules);

  for (const atom of atoms) {
    const key = callKey(atom.encoding);
    // First atom for a given callKey wins (higher-precedence modules first)
    if (!map.has(key)) {
      map.set(key, {
        atomId: `${atom.moduleId}/${atom.meaningId}`,
        meaningLabel: atom.meaningLabel,
      });
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
  bundle: ConventionBundle,
  spec: ConventionSpec,
  seed: number,
  atomCallMap: Map<string, { atomId: string; meaningLabel: string }>,
  vulnerability: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "natural",
): PlaythroughResult {
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerOf(userSeat);
  const strategy = createSpecStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createOpponentStrategy("natural")
    : null;

  const initAuction = buildInitialAuction(bundle, userSeat, deal);
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

    // Map recommendation to atom via callKey
    const bidCallKey = callKey(result.call);
    const match = atomCallMap.get(bidCallKey);
    const atomId = match?.atomId ?? null;
    const meaningLabel = match?.meaningLabel ?? null;
    if (atomId) {
      atomsCovered.push(atomId);
    }

    steps.push({
      stepIndex: steps.length,
      seat: activeSeat,
      atomId,
      meaningLabel,
      auctionEntries: [...entries],
      recommendation: bidCallKey,
      isUserStep: activeSeat === userSeat || activeSeat === partner,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, deal, userSeat, bundleName: bundle.name, steps, atomsCovered };
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
  bundle: ConventionBundle,
  seed: number,
  vulnerability: Vulnerability = Vulnerability.None,
): { viewportFeedback: ReturnType<typeof buildViewportFeedback>; teachingDetail: ReturnType<typeof buildTeachingDetail>; isCorrect: boolean; isAcceptable: boolean } {
  // Rebuild context for this step to get full teaching feedback
  const deal = generateSeededDeal(bundle, seed, vulnerability);
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
