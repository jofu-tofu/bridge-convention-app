// ── Playthrough evaluator ────────────────────────────────────────────
//
// Facade for end-to-end auction playthrough evaluation. Consumers
// provide a bundle ID + seed and get back viewport-only types.
//
// Internal strategy/teaching/convention access is encapsulated here.

import { replay, getBaseModules } from "../conventions/core";
import { getBundle } from "../conventions/core/bundle";
import { getConventionSpec } from "../conventions/spec-registry";
import { createBiddingContext } from "../conventions/core/context-factory";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { createStrategyChain } from "../strategy/bidding/strategy-chain";
import { resolveTeachingAnswer, gradeBid } from "../teaching/teaching-resolution";
import { BidGrade } from "../core/contracts/teaching-grading";
import type { BidResult, BiddingStrategy, BidHistoryEntry } from "../core/contracts/bidding";
import { buildViewportFeedback, buildTeachingDetail, buildBiddingViewport } from "../core/viewport/build-viewport";
import type { BiddingViewport } from "../core/viewport/player-viewport";
import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../core/util/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey } from "../engine/call-helpers";
import { parsePatternCall } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { Seat, Vulnerability } from "../engine/types";
import type { Auction, Call, Deal, Hand, DealConstraints } from "../engine/types";
import type { ConventionSpec } from "../conventions/core";
import type { ConventionBundle } from "../conventions/core/bundle/bundle-types";
import type { OpponentMode } from "../core/contracts/drill";
import type { PlaythroughHandle, PlaythroughGradeResult, RevealStep } from "./types";

// ── Internal helpers ────────────────────────────────────────────────

function nextSeatClockwise(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.East;
    case Seat.East: return Seat.South;
    case Seat.South: return Seat.West;
    case Seat.West: return Seat.North;
  }
}

function partnerOf(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.South;
    case Seat.South: return Seat.North;
    case Seat.East: return Seat.West;
    case Seat.West: return Seat.East;
  }
}

function generateSeededDeal(bundle: ConventionBundle, seed: number, vulnerability?: Vulnerability): Deal {
  const rng = mulberry32(seed);
  const constraints: DealConstraints = {
    ...bundle.dealConstraints,
    ...(vulnerability !== undefined ? { vulnerability } : {}),
  };
  return generateDeal(constraints, rng).deal;
}

function resolveUserSeat(bundle: ConventionBundle, deal: Deal): Seat {
  for (const seat of [Seat.South, Seat.East, Seat.North, Seat.West]) {
    if (bundle.defaultAuction) {
      const auction = bundle.defaultAuction(seat, deal);
      if (auction && auction.entries.length > 0) return seat;
    }
  }
  return Seat.South;
}

function buildInitialAuction(bundle: ConventionBundle, userSeat: Seat, deal: Deal): Auction {
  if (bundle.defaultAuction) {
    const auction = bundle.defaultAuction(userSeat, deal);
    if (auction) return auction;
  }
  return { entries: [], isComplete: false };
}

function buildContext(hand: Hand, auction: Auction, seat: Seat, vulnerability: Vulnerability) {
  return createBiddingContext({
    hand, auction, seat,
    evaluation: evaluateHand(hand),
    vulnerability,
    dealer: auction.entries.length > 0 ? auction.entries[0]!.seat : Seat.North,
  });
}

function buildBidHistory(
  auction: Auction, deal: Deal, userSeat: Seat,
  strategy: BiddingStrategy, vulnerability: Vulnerability,
): BidHistoryEntry[] {
  const partner = partnerOf(userSeat);
  const history: BidHistoryEntry[] = [];
  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;
    if (entry.seat !== userSeat && entry.seat !== partner) {
      history.push({ seat: entry.seat, call: entry.call, isUser: false });
      continue;
    }
    const auctionBefore: Auction = { entries: auction.entries.slice(0, i), isComplete: false };
    const ctx = buildContext(deal.hands[entry.seat], auctionBefore, entry.seat, vulnerability);
    const result = strategy.suggest(ctx);
    history.push({
      seat: entry.seat, call: entry.call,
      meaning: result?.meaning, isUser: entry.seat === userSeat,
      alertLabel: result?.alert?.teachingLabel,
      annotationType: result?.alert?.annotationType,
    });
  }
  return history;
}

function makeViewport(
  deal: Deal, auction: Auction, userSeat: Seat, activeSeat: Seat,
  strategy: BiddingStrategy, bundleName: string, vulnerability: Vulnerability,
): BiddingViewport {
  const bidHistory = buildBidHistory(auction, deal, userSeat, strategy, vulnerability);
  return buildBiddingViewport({
    deal, userSeat: activeSeat, auction, bidHistory,
    legalCalls: getLegalCalls(auction, activeSeat),
    faceUpSeats: new Set([activeSeat]),
    conventionName: bundleName,
    isUserTurn: true,
    currentBidder: activeSeat,
  });
}

// ── Internal step type ──────────────────────────────────────────────

interface InternalStep {
  readonly stepIndex: number;
  readonly seat: Seat;
  readonly stateId: string | null;
  readonly atomId: string | null;
  readonly meaningLabel: string | null;
  readonly auctionEntries: readonly { seat: Seat; call: Call }[];
  readonly recommendation: string;
  readonly isUserStep: boolean;
}

interface InternalPlaythroughResult {
  readonly handle: PlaythroughHandle;
  readonly deal: Deal;
  readonly userSeat: Seat;
  readonly bundleName: string;
  readonly spec: ConventionSpec;
  readonly bundle: ConventionBundle;
  readonly steps: readonly InternalStep[];
  readonly userSteps: readonly InternalStep[];
}

// Module-level cache for the last playthrough (avoids re-running for step/grade calls)
let lastPlaythrough: InternalPlaythroughResult | null = null;

// ── Internal playthrough runner ─────────────────────────────────────

function runPlaythroughInternal(
  bundleId: string, seed: number,
  vulnerability: Vulnerability, opponents: OpponentMode,
): InternalPlaythroughResult {
  const spec = getConventionSpec(bundleId)!;
  const bundle = getBundle(bundleId)!;
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerOf(userSeat);
  const strategy = protocolSpecToStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createStrategyChain([naturalFallbackStrategy])
    : null;

  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];
  const steps: InternalStep[] = [];
  const atomsCovered: string[] = [];
  const atomCallMap = buildAtomCallMap(spec);
  const maxIter = 30;

  for (let iter = 0; iter < maxIter; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

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
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) break;
      }
      continue;
    }

    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat, vulnerability);
    const result = strategy.suggest(context);
    if (!result) break;

    const snapshot = replay(
      entries.map((e) => ({ call: e.call, seat: e.seat })),
      spec, userSeat,
    );
    const stateId = snapshot.base?.stateId ?? null;

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
      stateId, atomId, meaningLabel,
      auctionEntries: [...entries],
      recommendation: callKey(result.call),
      isUserStep: activeSeat === userSeat || activeSeat === partner,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  const userSteps = steps.filter((s) => s.isUserStep);
  const handle: PlaythroughHandle = { seed, totalUserSteps: userSteps.length, atomsCovered };

  return { handle, deal, userSeat, bundleName: bundle.name, spec, bundle, steps, userSteps };
}

function buildAtomCallMap(spec: ConventionSpec): Map<string, { atomId: string; meaningLabel: string }> {
  const map = new Map<string, { atomId: string; meaningLabel: string }>();
  for (const track of getBaseModules(spec)) {
    for (const [stateId, state] of Object.entries(track.states)) {
      if (!state.surface) continue;
      const fragment = spec.surfaces[state.surface];
      if (!fragment) continue;
      for (const surface of fragment.surfaces) {
        const call = surface.encoding?.defaultCall;
        if (call) {
          map.set(`${stateId}|${callKey(call)}`, {
            atomId: `${stateId}/${state.surface}/${surface.meaningId}`,
            meaningLabel: surface.teachingLabel,
          });
        }
      }
    }
  }
  return map;
}

function getOrRunPlaythrough(
  bundleId: string, seed: number,
  vulnerability: Vulnerability, opponents: OpponentMode,
): InternalPlaythroughResult {
  if (lastPlaythrough && lastPlaythrough.handle.seed === seed && lastPlaythrough.bundleName === getBundle(bundleId)?.name) {
    return lastPlaythrough;
  }
  lastPlaythrough = runPlaythroughInternal(bundleId, seed, vulnerability, opponents);
  return lastPlaythrough;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Start a playthrough. Returns an opaque handle + the first step viewport.
 */
export function startPlaythrough(
  bundleId: string, seed: number,
  vuln: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): { handle: PlaythroughHandle; firstStep: BiddingViewport | null } {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents);
  const first = pt.userSteps[0];
  if (!first) return { handle: pt.handle, firstStep: null };

  const strategy = protocolSpecToStrategy(pt.spec);
  const auction: Auction = { entries: [...first.auctionEntries], isComplete: false };
  const viewport = makeViewport(pt.deal, auction, pt.userSeat, first.seat, strategy, pt.bundleName, vuln);
  return { handle: pt.handle, firstStep: viewport };
}

/**
 * Get the viewport for a specific playthrough step.
 */
export function getPlaythroughStepViewport(
  bundleId: string, seed: number, stepIdx: number,
  vuln: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): BiddingViewport {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents);
  const s = pt.userSteps[stepIdx];
  if (!s) throw new Error(`Step ${stepIdx} out of range (0-${pt.userSteps.length - 1})`);

  const strategy = protocolSpecToStrategy(pt.spec);
  const auction: Auction = { entries: [...s.auctionEntries], isComplete: false };
  return makeViewport(pt.deal, auction, pt.userSeat, s.seat, strategy, pt.bundleName, vuln);
}

/**
 * Grade a bid at a playthrough step. Returns viewport + feedback + next step.
 */
export function gradePlaythroughBid(
  bundleId: string, seed: number, stepIdx: number, bidStr: string,
  vuln: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): PlaythroughGradeResult {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents);
  const s = pt.userSteps[stepIdx];
  if (!s) throw new Error(`Step ${stepIdx} out of range (0-${pt.userSteps.length - 1})`);

  const strategy = protocolSpecToStrategy(pt.spec);
  const auction: Auction = { entries: [...s.auctionEntries], isComplete: false };
  const viewport = makeViewport(pt.deal, auction, pt.userSeat, s.seat, strategy, pt.bundleName, vuln);

  const submittedCall = parsePatternCall(bidStr);
  const hand = pt.deal.hands[s.seat];
  const context = buildContext(hand, auction, s.seat, vuln);
  const result = strategy.suggest(context);

  if (!result) {
    const fallbackResult: BidResult = { call: { type: "pass" }, ruleName: null, explanation: "No convention bid applies" };
    const fallbackResolution = resolveTeachingAnswer(fallbackResult);
    const feedbackInput = {
      grade: BidGrade.Incorrect as BidGrade, userCall: submittedCall, expectedResult: fallbackResult,
      teachingResolution: fallbackResolution, practicalRecommendation: null,
      teachingProjection: null, practicalScoreBreakdown: null,
      evaluationExhaustive: false, fallbackReached: true,
    };
    return {
      step: viewport, grade: BidGrade.Incorrect, correct: false, acceptable: false,
      feedback: buildViewportFeedback(feedbackInput),
      teaching: buildTeachingDetail(feedbackInput),
      nextStep: null, complete: true, yourBid: callKey(submittedCall),
    };
  }

  const strategyEval = (strategy).getLastEvaluation?.() ?? null;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.acceptableAlternatives ?? undefined,
    strategyEval?.intentFamilies ?? undefined,
  );
  const grade = gradeBid(submittedCall, teachingResolution);
  const bidFeedback = {
    grade, userCall: submittedCall, expectedResult: result, teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    evaluationExhaustive: (strategyEval?.arbitration as any)?.evidenceBundle?.exhaustive ?? false,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    fallbackReached: (strategyEval?.arbitration as any)?.evidenceBundle?.fallbackReached ?? false,
  };

  const isCorrect = grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred;
  const isAcceptable = grade === BidGrade.Acceptable;

  // Next step viewport
  const nextStepIdx = stepIdx + 1;
  let nextStep: BiddingViewport | null = null;
  if (nextStepIdx < pt.userSteps.length) {
    const ns = pt.userSteps[nextStepIdx]!;
    const nsAuction: Auction = { entries: [...ns.auctionEntries], isComplete: false };
    nextStep = makeViewport(pt.deal, nsAuction, pt.userSeat, ns.seat, strategy, pt.bundleName, vuln);
  }

  return {
    step: viewport,
    grade: grade as string,
    correct: isCorrect,
    acceptable: isAcceptable,
    feedback: buildViewportFeedback(bidFeedback),
    teaching: buildTeachingDetail(bidFeedback),
    nextStep,
    complete: nextStep === null,
    yourBid: callKey(submittedCall),
  };
}

/**
 * Get all steps in reveal mode (includes internal metadata).
 */
export function getPlaythroughRevealSteps(
  bundleId: string, seed: number,
  vuln: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): { totalSteps: number; steps: readonly RevealStep[]; atomsCovered: readonly string[] } {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents);
  const revealSteps: RevealStep[] = pt.steps.map((s) => ({
    stepIndex: s.stepIndex,
    seat: s.seat as string,
    stateId: s.stateId,
    atomId: s.atomId,
    meaningLabel: s.meaningLabel,
    auctionSoFar: s.auctionEntries.map((e) => ({ seat: e.seat as string, call: callKey(e.call) })),
    recommendation: s.recommendation,
    isUserStep: s.isUserStep,
  }));
  return { totalSteps: pt.userSteps.length, steps: revealSteps, atomsCovered: pt.handle.atomsCovered };
}
