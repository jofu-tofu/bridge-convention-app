// ── Atom evaluator ──────────────────────────────────────────────────
//
// Facade for per-atom convention evaluation. Consumers provide a
// bundle ID + atom ID + seed and get back viewport-only types.
//
// All strategy, teaching, and convention internals are encapsulated
// here — consumers never touch them directly.

import { getConventionSpec } from "../conventions/spec-registry";
import {
  generateProtocolCoverageManifest,
  getBaseModules,
  enumerateBaseTrackStates,
  type BaseTrackPath,
} from "../conventions/core";
import { getBundle } from "../conventions/core/bundle";
import { createBiddingContext } from "../conventions/core/context-factory";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
import { resolveTeachingAnswer, gradeBid } from "../teaching/teaching-resolution";
import { BidGrade } from "../core/contracts/teaching-grading";
import { buildViewportFeedback, buildTeachingDetail, buildBiddingViewport } from "../core/viewport/build-viewport";
import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../core/util/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey } from "../engine/call-helpers";
import { parsePatternCall } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { Seat, Vulnerability } from "../engine/types";
import type { Auction, Deal, Hand, DealConstraints } from "../engine/types";
import type { BiddingStrategy, BidHistoryEntry } from "../core/contracts/bidding";
import type { ConventionSpec } from "../conventions/core";
import type { ConventionBundle } from "../conventions/core/bundle/bundle-types";
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

function findPathToState(spec: ConventionSpec, targetStateId: string): BaseTrackPath | null {
  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    const path = paths.get(targetStateId);
    if (path) return path;
  }
  return null;
}

function buildTargetedAuction(defaultAuction: Auction, path: BaseTrackPath, userSeat: Seat): Auction {
  const entries = [...defaultAuction.entries];
  const transitionsToAdd = path.transitions.slice(1);
  if (transitionsToAdd.length === 0) return { entries, isComplete: false };

  let currentSeat = nextSeatClockwise(entries[entries.length - 1]!.seat);
  const partner = partnerOf(userSeat);

  for (const transition of transitionsToAdd) {
    if (!transition.call) continue;
    if (transition.call.type !== "pass") {
      while (currentSeat !== userSeat && currentSeat !== partner) {
        entries.push({ seat: currentSeat, call: { type: "pass" } });
        currentSeat = nextSeatClockwise(currentSeat);
      }
    }
    entries.push({ seat: currentSeat, call: transition.call });
    currentSeat = nextSeatClockwise(currentSeat);
  }

  while (currentSeat !== userSeat && currentSeat !== partner) {
    entries.push({ seat: currentSeat, call: { type: "pass" } });
    currentSeat = nextSeatClockwise(currentSeat);
  }
  return { entries, isComplete: false };
}

function resolveAuction(bundle: ConventionBundle, spec: ConventionSpec, deal: Deal, targetStateId: string, userSeat: Seat) {
  const defaultAuction = buildInitialAuction(bundle, userSeat, deal);
  const path = findPathToState(spec, targetStateId);
  if (!path || path.transitions.some((t) => t.call === null)) {
    return { auction: defaultAuction, targeted: false };
  }
  return { auction: buildTargetedAuction(defaultAuction, path, userSeat), targeted: true };
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

// ── Public API ──────────────────────────────────────────────────────

/** Validate that an atom ID exists in a bundle's coverage manifest. */
export function validateAtomId(bundleId: string, atomId: string): void {
  const spec = getConventionSpec(bundleId);
  if (!spec) throw new Error(`Unknown bundle: "${bundleId}"`);
  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
  const exists = allAtoms.some(
    (a) => `${a.baseStateId}/${a.surfaceId}/${a.meaningId}` === atomId,
  );
  if (!exists) throw new Error(`Unknown atom: "${atomId}"`);
}

/** Parse an atom ID into components. */
export function parseAtomId(atomId: string): { stateId: string; surfaceId: string; meaningId: string } {
  const parts = atomId.split("/");
  if (parts.length < 3) throw new Error(`Invalid atom ID: "${atomId}"`);
  return { stateId: parts[0]!, surfaceId: parts[1]!, meaningId: parts.slice(2).join("/") };
}

/**
 * Build a BiddingViewport for an atom — the pre-bid view the player sees.
 * Returns the SAME type the Svelte UI renders. No internals leak.
 */
export function buildAtomViewport(
  bundleId: string,
  atomId: string,
  seed: number,
  vuln: Vulnerability = Vulnerability.None,
): BiddingViewport {
  const { stateId } = parseAtomId(atomId);
  const spec = getConventionSpec(bundleId)!;
  const bundle = getBundle(bundleId)!;
  const strategy = protocolSpecToStrategy(spec);
  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);
  const { auction } = resolveAuction(bundle, spec, deal, stateId, userSeat);
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
): AtomGradeResult {
  const { stateId } = parseAtomId(atomId);
  const spec = getConventionSpec(bundleId)!;
  const bundle = getBundle(bundleId)!;
  const strategy = protocolSpecToStrategy(spec);
  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);
  const { auction } = resolveAuction(bundle, spec, deal, stateId, userSeat);
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
