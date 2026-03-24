// ── Playthrough evaluator ────────────────────────────────────────────
//
// Facade for end-to-end auction playthrough evaluation. Consumers
// provide a bundle ID + seed and get back viewport-only types.
//
// Internal strategy/teaching/convention access is encapsulated here.

import type { BaseSystemId } from "../../conventions/definitions/system-config";
import { BASE_SYSTEM_SAYC } from "../../conventions/definitions/system-config";
import { getSystemConfig } from "../../conventions/definitions/system-config";
import { getBundleInput, resolveBundle as resolveBundleFn, specFromBundle } from "../../conventions";
import { enumerateRuleAtoms } from "../../conventions";
import { protocolSpecToStrategy } from "../../strategy/bidding/protocol-adapter";
import { naturalFallbackStrategy } from "../../strategy/bidding/natural-fallback";
import { createStrategyChain } from "../../strategy/bidding/strategy-chain";
import { resolveTeachingAnswer, gradeBid } from "../../conventions";
import { BidGrade } from "../../conventions/teaching/teaching-types";
import type { BidResult } from "../../strategy/bidding/bidding-types";
import { buildViewportFeedback, buildTeachingDetail, projectObservationHistory } from "../build-viewport";
import type { BiddingViewport } from "../response-types";
import { callKey } from "../../engine/call-helpers";
import { parsePatternCall } from "../../engine/auction-helpers";
import { Vulnerability } from "../../engine/types";
import type { Auction, Call, Deal,  Seat} from "../../engine/types";
import type { ConventionBundle } from "../../conventions";
import type { ConventionSpec } from "../../conventions";
import type { OpponentMode } from "../../bootstrap/drill-types";
import type { PlaythroughHandle, PlaythroughGradeResult, RevealStep } from "./types";
import { nextSeat, partnerSeat, generateSeededDeal, resolveUserSeat, buildInitialAuction, buildContext, makeViewport } from "./helpers";

// ── Internal step type // ── Internal step type ──────────────────────────────────────────────

interface InternalStep {
  readonly stepIndex: number;
  readonly seat: Seat;
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
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): InternalPlaythroughResult {
  const input = getBundleInput(bundleId)!;
  const bundle = resolveBundleFn(input, getSystemConfig(baseSystem));
  const spec = specFromBundle(input, getSystemConfig(baseSystem))!;
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerSeat(userSeat);
  const strategy = protocolSpecToStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createStrategyChain([naturalFallbackStrategy])
    : null;

  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];
  const steps: InternalStep[] = [];
  const atomsCovered: string[] = [];
  const atomCallMap = buildAtomCallMap(bundleId);
  const maxIter = 30;

  for (let iter = 0; iter < maxIter; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeat(entries[entries.length - 1]!.seat)
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

    // Match the recommended call to a rule atom
    let atomId: string | null = null;
    let meaningLabel: string | null = null;
    const match = atomCallMap.get(callKey(result.call));
    if (match) {
      atomId = match.atomId;
      meaningLabel = match.meaningLabel;
      atomsCovered.push(atomId);
    }

    steps.push({
      stepIndex: steps.length,
      seat: activeSeat,
      atomId, meaningLabel,
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

/**
 * Build a call → atom mapping from rule modules.
 * Key: callKey, Value: { atomId, meaningLabel }.
 * When multiple atoms share the same encoding, the first one wins.
 */
function buildAtomCallMap(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): Map<string, { atomId: string; meaningLabel: string }> {
  const input = getBundleInput(bundleId);
  if (!input) return new Map();
  const bundle = resolveBundleFn(input, getSystemConfig(baseSystem));
  const atoms = enumerateRuleAtoms(bundle.modules);
  const map = new Map<string, { atomId: string; meaningLabel: string }>();

  for (const atom of atoms) {
    const key = callKey(atom.encoding);
    if (!map.has(key)) {
      map.set(key, {
        atomId: `${atom.moduleId}/${atom.meaningId}`,
        meaningLabel: atom.meaningLabel,
      });
    }
  }

  return map;
}

function getOrRunPlaythrough(
  bundleId: string, seed: number,
  vulnerability: Vulnerability, opponents: OpponentMode,
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): InternalPlaythroughResult {
  if (lastPlaythrough && lastPlaythrough.handle.seed === seed && lastPlaythrough.bundleName === getBundleInput(bundleId)?.name) {
    return lastPlaythrough;
  }
  lastPlaythrough = runPlaythroughInternal(bundleId, seed, vulnerability, opponents, baseSystem);
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
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): { handle: PlaythroughHandle; firstStep: BiddingViewport | null } {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents, baseSystem);
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
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): BiddingViewport {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents, baseSystem);
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
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): PlaythroughGradeResult {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents, baseSystem);
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
    const fallbackResult: BidResult = { call: { type: "pass" }, ruleName: null, explanation: "No convention applies — pass by default" };
    const fallbackResolution = resolveTeachingAnswer(fallbackResult);
    const feedbackInput = {
      grade: BidGrade.Incorrect as BidGrade, userCall: submittedCall, expectedResult: fallbackResult,
      teachingResolution: fallbackResolution, practicalRecommendation: null,
      teachingProjection: {
        callViews: [], meaningViews: [], primaryExplanation: [],
        whyNot: [], conventionsApplied: [],
        handSpace: { seatLabel: "South", hcpRange: { min: 0, max: 40 }, shapeDescription: "Unknown" },
        evaluationExhaustive: false, fallbackReached: true,
      },
      practicalScoreBreakdown: null,
    };
    return {
      step: viewport, grade: BidGrade.Incorrect, correct: false, acceptable: false,
      feedback: buildViewportFeedback(feedbackInput),
      teaching: buildTeachingDetail(feedbackInput),
      nextStep: null, complete: true, yourBid: callKey(submittedCall),
    };
  }

  const strategyEval = (strategy).getLastEvaluation?.() ?? null;
  const bundleInputForAlts = getBundleInput(bundleId);
  const bundleForAlts = bundleInputForAlts ? resolveBundleFn(bundleInputForAlts, getSystemConfig(baseSystem)) : undefined;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.surfaceGroups ?? bundleForAlts?.derivedTeaching.surfaceGroups ?? undefined,
  );
  const grade = gradeBid(submittedCall, teachingResolution);
  const bidFeedback = {
    grade, userCall: submittedCall, expectedResult: result, teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    observationHistory: projectObservationHistory(strategyEval?.auctionContext),
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
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): { totalSteps: number; steps: readonly RevealStep[]; atomsCovered: readonly string[] } {
  const pt = getOrRunPlaythrough(bundleId, seed, vuln, opponents, baseSystem);
  const revealSteps: RevealStep[] = pt.steps.map((s) => ({
    stepIndex: s.stepIndex,
    seat: s.seat as string,
    stateId: null,
    atomId: s.atomId,
    meaningLabel: s.meaningLabel,
    auctionSoFar: s.auctionEntries.map((e) => ({ seat: e.seat as string, call: callKey(e.call) })),
    recommendation: s.recommendation,
    isUserStep: s.isUserStep,
  }));
  return { totalSteps: pt.userSteps.length, steps: revealSteps, atomsCovered: pt.handle.atomsCovered };
}
