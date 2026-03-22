// ── Atom evaluator ──────────────────────────────────────────────────
//
// Facade for per-atom convention evaluation. Consumers provide a
// bundle ID + atom ID + seed and get back viewport-only types.
//
// All strategy, teaching, and convention internals are encapsulated
// here — consumers never touch them directly.
//
// Phase 6: Uses rule enumeration (RuleAtom) instead of FSM BFS coverage.
// Atom ID format: `moduleId/meaningId`.

import type { BaseSystemId } from "../core/contracts/base-system-vocabulary";
import { BASE_SYSTEM_SAYC } from "../core/contracts/base-system-vocabulary";
import { getSystemConfig } from "../core/contracts/system-config";
import { getSystemBundle, specFromBundle } from "../conventions/definitions/system-registry";
import { enumerateRuleAtoms, type RuleAtom } from "../conventions/core";
import { getBundle } from "../conventions/core/bundle";
import { createBiddingContext } from "../conventions/core/context-factory";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
import { resolveTeachingAnswer, gradeBid } from "../teaching/teaching-resolution";
import { BidGrade } from "../core/contracts/teaching-grading";
import { buildViewportFeedback, buildTeachingDetail, buildBiddingViewport, projectObservationHistory } from "../core/viewport/build-viewport";
import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../core/util/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey, callsMatch } from "../engine/call-helpers";
import { parsePatternCall } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { Seat, Vulnerability } from "../engine/types";
import type { Auction, Deal, Hand, DealConstraints, Call } from "../engine/types";
import type { BiddingStrategy, BidHistoryEntry } from "../core/contracts/bidding";
import type { ConventionStrategy } from "../core/contracts/recommendation";
import type { ConventionBundle } from "../conventions/core";
import type { BiddingViewport } from "../core/viewport/player-viewport";
import type { AtomGradeResult } from "./types";

// ── Internal helpers (not exported) ─────────────────────────────────

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

function generateSeededDeal(
  bundle: ConventionBundle,
  seed: number,
  vulnerability?: Vulnerability,
): Deal {
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
    hand,
    auction,
    seat,
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
    // Only use the strategy's alert/meaning when the suggested bid matches the actual bid.
    // In targeted auctions, the forced bid may differ from what the strategy would suggest
    // for the given hand, which would produce wrong alert labels.
    const bidMatches = result && callsMatch(result.call, entry.call);
    history.push({
      seat: entry.seat, call: entry.call,
      meaning: bidMatches ? result?.meaning : undefined, isUser: entry.seat === userSeat,
      alertLabel: bidMatches ? result?.alert?.teachingLabel : undefined,
      annotationType: bidMatches ? result?.alert?.annotationType : undefined,
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

/** Resolve the atom list for a bundle using rule enumeration. */
function resolveAtoms(bundleId: string): readonly RuleAtom[] {
  const bundle = getSystemBundle(bundleId);
  if (!bundle?.ruleModules) return [];
  return enumerateRuleAtoms(bundle.ruleModules);
}

/** Create a strategy from a bundle ID. */
function createStrategy(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): BiddingStrategy {
  const bundle = getSystemBundle(bundleId);
  if (!bundle) throw new Error(`Unknown bundle: "${bundleId}"`);
  const spec = specFromBundle(bundle, getSystemConfig(baseSystem));
  if (!spec) throw new Error(`No spec for bundle: "${bundleId}"`);
  return protocolSpecToStrategy(spec);
}

/**
 * Strategy-driven forward auction construction.
 *
 * Starts from the bundle's initial auction, then runs the strategy in a
 * loop to extend the auction until the strategy produces the atom's
 * expected encoding or hits a safety limit. Opponents always pass.
 *
 * Falls back to the initial auction if the atom's position isn't reached.
 */
function buildForwardAuction(
  bundle: ConventionBundle,
  strategy: BiddingStrategy,
  deal: Deal,
  userSeat: Seat,
  atom: RuleAtom,
  vuln: Vulnerability,
): { auction: Auction; reached: boolean } {
  const partner = partnerOf(userSeat);
  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];
  const maxBids = 20;

  for (let iter = 0; iter < maxBids; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponents always pass
    if (activeSeat !== userSeat && activeSeat !== partner) {
      entries.push({ seat: activeSeat, call: { type: "pass" } });
      // Check 3 consecutive passes after a bid → auction complete
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) {
          return { auction: { entries, isComplete: true }, reached: false };
        }
      }
      continue;
    }

    // Convention player's turn — ask the strategy what to bid
    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat, vuln);
    const result = strategy.suggest(context);

    if (!result) {
      return { auction: { entries, isComplete: false }, reached: false };
    }

    // Check if this bid matches the atom's encoding
    if (callsMatch(result.call, atom.encoding)) {
      return { auction: { entries, isComplete: false }, reached: true };
    }

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { auction: { entries, isComplete: false }, reached: false };
}

// ── Public API ──────────────────────────────────────────────────────

/** Validate that an atom ID exists in a bundle's rule atoms. */
export function validateAtomId(bundleId: string, atomId: string): void {
  const atoms = resolveAtoms(bundleId);
  if (atoms.length === 0) throw new Error(`Unknown bundle or no rule modules: "${bundleId}"`);
  const exists = atoms.some((a) => `${a.moduleId}/${a.meaningId}` === atomId);
  if (!exists) throw new Error(`Unknown atom: "${atomId}"`);
}

/** Parse an atom ID into components (new format: moduleId/meaningId). */
export function parseAtomId(atomId: string): { moduleId: string; meaningId: string } {
  const slashIdx = atomId.indexOf("/");
  if (slashIdx < 0) throw new Error(`Invalid atom ID: "${atomId}"`);
  return { moduleId: atomId.slice(0, slashIdx), meaningId: atomId.slice(slashIdx + 1) };
}

/**
 * Build a BiddingViewport for an atom — the pre-bid view the player sees.
 * Returns the SAME type the Svelte UI renders. No internals leak.
 *
 * Uses strategy-driven forward auction construction to reach the atom's
 * target position in the auction. Falls back to the initial auction if
 * the atom's position isn't reachable.
 */
export function buildAtomViewport(
  bundleId: string,
  atomId: string,
  seed: number,
  vuln: Vulnerability = Vulnerability.None,
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): BiddingViewport {
  validateAtomId(bundleId, atomId);
  const bundle = getBundle(bundleId)!;
  const strategy = createStrategy(bundleId, baseSystem);
  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);

  // Resolve atom for forward auction targeting
  const { moduleId, meaningId } = parseAtomId(atomId);
  const atoms = resolveAtoms(bundleId);
  const atom = atoms.find((a) => a.moduleId === moduleId && a.meaningId === meaningId);

  let auction: Auction;
  if (atom) {
    const fwd = buildForwardAuction(bundle, strategy, deal, userSeat, atom, vuln);
    auction = fwd.auction;
  } else {
    auction = buildInitialAuction(bundle, userSeat, deal);
  }

  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;

  return makeViewport(deal, auction, userSeat, activeSeat, strategy, bundle.name, vuln);
}

/**
 * Grade a bid for an atom. Returns viewport + feedback + teaching —
 * all composed from viewport types only.
 */
export function gradeAtomBid(
  bundleId: string,
  atomId: string,
  seed: number,
  bidStr: string,
  vuln: Vulnerability = Vulnerability.None,
  baseSystem: BaseSystemId = BASE_SYSTEM_SAYC,
): AtomGradeResult {
  validateAtomId(bundleId, atomId);
  const bundle = getBundle(bundleId)!;
  const strategy = createStrategy(bundleId, baseSystem);
  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);

  // Resolve atom for forward auction targeting
  const { moduleId, meaningId } = parseAtomId(atomId);
  const atoms = resolveAtoms(bundleId);
  const atom = atoms.find((a) => a.moduleId === moduleId && a.meaningId === meaningId);

  let auction: Auction;
  if (atom) {
    const fwd = buildForwardAuction(bundle, strategy, deal, userSeat, atom, vuln);
    auction = fwd.auction;
  } else {
    auction = buildInitialAuction(bundle, userSeat, deal);
  }

  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;

  const viewport = makeViewport(deal, auction, userSeat, activeSeat, strategy, bundle.name, vuln);
  const submittedCall = parsePatternCall(bidStr);
  const hand = deal.hands[activeSeat];
  const context = buildContext(hand, auction, activeSeat, vuln);
  const result = strategy.suggest(context);

  if (!result) {
    return {
      viewport, grade: BidGrade.Correct, correct: false, acceptable: false,
      skip: true, feedback: null, teaching: null,
    };
  }

  const strategyEval = (strategy as ConventionStrategy).getLastEvaluation?.() ?? null;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.acceptableAlternatives ?? bundle.derivedTeaching.acceptableAlternatives ?? undefined,
    strategyEval?.intentFamilies ?? bundle.derivedTeaching.intentFamilies ?? undefined,
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
    observationHistory: projectObservationHistory(strategyEval?.auctionContext),
  };

  return {
    viewport,
    grade,
    correct: grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred,
    acceptable: grade === BidGrade.Acceptable,
    skip: false,
    yourBid: callKey(submittedCall),
    correctBid: callKey(result.call),
    feedback: buildViewportFeedback(bidFeedback),
    teaching: buildTeachingDetail(bidFeedback),
  };
}
