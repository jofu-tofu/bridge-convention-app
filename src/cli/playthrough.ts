// ── Playthrough infrastructure ──────────────────────────────────────
//
// Shared types and functions for running full auction playthroughs.
// Used by the play, plan, and (future) integration-test commands.

import {
  replay,
  getBaseModules,
} from "../conventions/core";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { createStrategyChain } from "../strategy/bidding/strategy-chain";
import { resolveTeachingAnswer, gradeBid } from "../teaching/teaching-resolution";
import { BidGrade } from "../core/contracts/teaching-grading";
import type { BidResult } from "../core/contracts/bidding";
import { buildViewportFeedback, buildTeachingDetail } from "../core/viewport/build-viewport";

import type { ConventionSpec, ConventionBundle, Auction, Call, OpponentMode, Seat } from "./shared";
import { Vulnerability,
  callKey, parsePatternCall, getLegalCalls, evaluateHand,
  generateSeededDeal, resolveUserSeat, buildInitialAuction, buildContext,
  formatHandBySuit, nextSeatClockwise, partnerOf,
} from "./shared";

// ── Types ───────────────────────────────────────────────────────────

export interface PlaythroughStep {
  readonly stepIndex: number;
  readonly seat: string;
  readonly stateId: string | null;
  readonly atomId: string | null;
  readonly meaningLabel: string | null;
  readonly hand: Record<string, string[]>;
  readonly hcp: number;
  readonly auctionSoFar: readonly { seat: string; call: string }[];
  readonly legalCalls: readonly string[];
  readonly recommendation: string;
  /** Whether this is a convention-player decision point (user or partner) vs opponent pass. */
  readonly isUserStep: boolean;
}

export interface PlaythroughResult {
  readonly seed: number;
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
  bundle: ConventionBundle,
  spec: ConventionSpec,
  seed: number,
  atomCallMap: Map<string, { atomId: string; meaningLabel: string }>,
  vulnerability: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): PlaythroughResult {
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerOf(userSeat);
  const strategy = protocolSpecToStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createStrategyChain([naturalFallbackStrategy])
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
      seat: activeSeat as string,
      stateId,
      atomId,
      meaningLabel,
      hand: formatHandBySuit(hand),
      hcp: evaluateHand(hand).hcp,
      auctionSoFar: entries.map((e) => ({ seat: e.seat as string, call: callKey(e.call) })),
      legalCalls: getLegalCalls(auction, activeSeat).map(callKey),
      recommendation: callKey(result.call),
      isUserStep: activeSeat === userSeat || activeSeat === partner,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, steps, atomsCovered };
}

// ── Step viewport ───────────────────────────────────────────────────

export function buildStepViewport(s: PlaythroughStep): Record<string, unknown> {
  return {
    index: s.stepIndex,
    seat: s.seat,
    hand: s.hand,
    hcp: s.hcp,
    auctionSoFar: s.auctionSoFar,
    legalCalls: s.legalCalls,
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
  const activeSeat = s.seat as Seat;
  const hand = deal.hands[activeSeat];
  const auction: Auction = { entries: s.auctionSoFar.map((e) => ({ seat: e.seat as Seat, call: parsePatternCall(e.call) })), isComplete: false };
  const context = buildContext(hand, auction, activeSeat, vulnerability);

  const strategy = protocolSpecToStrategy(spec);
  const result = strategy.suggest(context);

  if (!result) {
    const fallbackResult: BidResult = {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No convention bid applies",
    };
    const fallbackResolution = resolveTeachingAnswer(fallbackResult);
    const emptyFeedback = buildViewportFeedback({
      grade: BidGrade.Incorrect,
      userCall: submittedCall,
      expectedResult: fallbackResult,
      teachingResolution: fallbackResolution,
      practicalRecommendation: null,
      teachingProjection: null,
      practicalScoreBreakdown: null,
      evaluationExhaustive: false,
      fallbackReached: true,
    });
    const emptyTeaching = buildTeachingDetail({
      grade: BidGrade.Incorrect,
      userCall: submittedCall,
      expectedResult: fallbackResult,
      teachingResolution: fallbackResolution,
      practicalRecommendation: null,
      teachingProjection: null,
      practicalScoreBreakdown: null,
      evaluationExhaustive: false,
      fallbackReached: true,
    });
    return { viewportFeedback: emptyFeedback, teachingDetail: emptyTeaching, isCorrect: false, isAcceptable: false };
  }

  const strategyEval = (strategy).getLastEvaluation?.() ?? null;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.acceptableAlternatives ?? undefined,
    strategyEval?.intentFamilies ?? undefined,
  );
  const grade = gradeBid(submittedCall, teachingResolution);
  const bidFeedback = {
    grade,
    userCall: submittedCall,
    expectedResult: result,
    teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    evaluationExhaustive: (strategyEval?.arbitration as any)?.evidenceBundle?.exhaustive ?? false,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    fallbackReached: (strategyEval?.arbitration as any)?.evidenceBundle?.fallbackReached ?? false,
  };

  return {
    viewportFeedback: buildViewportFeedback(bidFeedback),
    teachingDetail: buildTeachingDetail(bidFeedback),
    isCorrect: grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred,
    isAcceptable: grade === BidGrade.Acceptable,
  };
}
