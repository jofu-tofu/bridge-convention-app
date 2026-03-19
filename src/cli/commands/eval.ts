// ── CLI eval command ────────────────────────────────────────────────

import {
  generateProtocolCoverageManifest,
} from "../../conventions/core";
import { protocolSpecToStrategy } from "../../strategy/bidding/protocol-adapter";
import { resolveTeachingAnswer, gradeBid } from "../../teaching/teaching-resolution";
import { BidGrade } from "../../core/contracts/teaching-grading";
import type { ConventionBiddingStrategy } from "../../core/contracts/recommendation";
import { buildViewportFeedback, buildTeachingDetail } from "../../core/viewport/build-viewport";

import type { Flags, Vulnerability, ConventionSpec, Call } from "../shared";
import {
  callKey, parsePatternCall, getLegalCalls, evaluateHand,
  requireArg, optionalNumericArg,
  resolveSpec, resolveBundle, generateSeededDeal, resolveUserSeat,
  resolveAuction, buildContext, formatHandBySuit, nextSeatClockwise,
} from "../shared";

// ── Atom parsing ────────────────────────────────────────────────────

function parseAtomId(atomId: string): { stateId: string; surfaceId: string; meaningId: string } {
  const parts = atomId.split("/");
  if (parts.length < 3) {
    console.error(`Invalid atom ID: "${atomId}" (expected stateId/surfaceId/meaningId)`);
    process.exit(2);
  }
  return {
    stateId: parts[0]!,
    surfaceId: parts[1]!,
    meaningId: parts.slice(2).join("/"),
  };
}

function validateAtomId(
  atomId: string,
  spec: ConventionSpec,
): void {
  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
  const exists = allAtoms.some(
    (a) => `${a.baseStateId}/${a.surfaceId}/${a.meaningId}` === atomId,
  );
  if (!exists) {
    console.error(`Unknown atom: "${atomId}"`);
    console.error("Use 'list --bundle=<id>' to see valid atom IDs.");
    process.exit(2);
  }
}

// ── Command ─────────────────────────────────────────────────────────

export function runEval(flags: Flags, vuln: Vulnerability): void {
  const bundleId = requireArg(flags, "bundle");
  const atomId = requireArg(flags, "atom");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const bidStr = flags["bid"] as string | undefined;

  const { stateId } = parseAtomId(atomId);
  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  validateAtomId(atomId, spec);

  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);
  const { auction, targeted: _targeted } = resolveAuction(bundle, spec, deal, stateId, userSeat);

  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;
  const hand = deal.hands[activeSeat];
  const legalCalls = getLegalCalls(auction, activeSeat).map(callKey);

  // Viewport — always included, always sanitized
  const viewport = {
    seat: activeSeat as string,
    hand: formatHandBySuit(hand),
    hcp: evaluateHand(hand).hcp,
    auction: auction.entries.map((e) => ({
      seat: e.seat as string,
      call: callKey(e.call),
    })),
    legalCalls,
  };

  if (!bidStr || bidStr === "true") {
    // No bid: return viewport only
    console.log(JSON.stringify(viewport, null, 2));
    return;
  }

  // Bid submitted: grade with full teaching feedback
  let submittedCall: Call;
  try {
    submittedCall = parsePatternCall(bidStr);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  const strategy = protocolSpecToStrategy(spec);
  const context = buildContext(hand, auction, activeSeat, vuln);
  const result = strategy.suggest(context);

  if (!result) {
    console.log(JSON.stringify({
      viewport,
      grade: "skip",
      correct: false,
      skip: true,
      feedback: null,
      teaching: null,
    }, null, 2));
    process.exit(0);
    return;
  }

  const strategyEval = (strategy as ConventionBiddingStrategy).getLastEvaluation?.() ?? null;
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

  const viewportFeedback = buildViewportFeedback(bidFeedback);
  const teachingDetail = buildTeachingDetail(bidFeedback);
  const isCorrect = grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred;
  const isAcceptable = grade === BidGrade.Acceptable;

  console.log(JSON.stringify({
    viewport,
    yourBid: callKey(submittedCall),
    correctBid: callKey(result.call),
    grade,
    correct: isCorrect,
    acceptable: isAcceptable,
    skip: false,
    feedback: viewportFeedback,
    teaching: teachingDetail,
  }, null, 2));
  process.exit(isCorrect || isAcceptable ? 0 : 1);
}
