// Phase 7c: Evaluation trace tests
// Verifies that the EvaluationTrace DTO captures pipeline events.

import { describe, test, expect, beforeEach } from "vitest";
import { Seat } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { hand } from "../../engine/__tests__/fixtures";
import { buildAuction } from "../../engine/auction-helpers";
import { conventionToStrategy } from "../bidding/convention-strategy";
import { createStrategyChain } from "../bidding/strategy-chain";
import { TraceCollector } from "../bidding/trace-collector";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman/config";
import type { BiddingStrategy, BidResult } from "../../contracts";
import type { BiddingContext } from "../../conventions/core/types";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

describe("TraceCollector", () => {
  test("builds an EvaluationTrace with all fields", () => {
    const tc = new TraceCollector();
    tc.setConventionId("stayman");
    tc.setProtocolMatched(true);
    tc.setActiveRound("round1-ask");
    tc.addOverlayActivated("stayman-doubled");
    tc.addOverlayError("test-overlay", "suppressIntent", "boom");
    tc.setResolverOutcome("resolved");
    tc.setCandidateCount(3);
    tc.setSelectedTier("matched");
    tc.addStrategyAttempt("convention:stayman", "suggested");

    const trace = tc.build();
    expect(trace.conventionId).toBe("stayman");
    expect(trace.protocolMatched).toBe(true);
    expect(trace.activeRound).toBe("round1-ask");
    expect(trace.overlaysActivated).toEqual(["stayman-doubled"]);
    expect(trace.overlayErrors).toHaveLength(1);
    expect(trace.overlayErrors[0]!.hook).toBe("suppressIntent");
    expect(trace.resolverOutcome).toBe("resolved");
    expect(trace.candidateCount).toBe(3);
    expect(trace.selectedTier).toBe("matched");
    expect(trace.strategyChainPath).toHaveLength(1);
  });
});

describe("conventionToStrategy trace", () => {
  test("attaches evaluationTrace to BidResult on successful match", () => {
    // Responder with 4 hearts, 10+ HCP after 1NT-P
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const strategy = conventionToStrategy(staymanConfig);
    const result = strategy.suggest(context);

    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.conventionId).toBe("stayman");
    expect(result!.evaluationTrace!.protocolMatched).toBe(true);
    expect(result!.evaluationTrace!.candidateCount).toBeGreaterThan(0);
  });

  test("trace records activeRound name", () => {
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const strategy = conventionToStrategy(staymanConfig);
    const result = strategy.suggest(context);

    expect(result!.evaluationTrace!.activeRound).toBeDefined();
  });
});

describe("strategy chain trace", () => {
  test("chain records path of strategy attempts", () => {
    // A strategy that always declines
    const decliner: BiddingStrategy = {
      id: "test:decliner",
      name: "Decliner",
      suggest: () => null,
    };

    // A strategy that always suggests pass
    const passer: BiddingStrategy = {
      id: "test:passer",
      name: "Passer",
      suggest: (): BidResult => ({
        call: { type: "pass" },
        ruleName: "pass",
        explanation: "Pass",
      }),
    };

    const chain = createStrategyChain([decliner, passer]);

    const h = hand("S2", "S3", "S4", "H2", "H3", "H4", "D2", "D3", "D4", "D5", "C2", "C3", "C4");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).not.toBeNull();

    // The chain should record its strategy attempts on the trace
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.strategyChainPath).toHaveLength(2);
    expect(result!.evaluationTrace!.strategyChainPath[0]!.strategyId).toBe("test:decliner");
    expect(result!.evaluationTrace!.strategyChainPath[0]!.result).toBe("declined");
    expect(result!.evaluationTrace!.strategyChainPath[1]!.strategyId).toBe("test:passer");
    expect(result!.evaluationTrace!.strategyChainPath[1]!.result).toBe("suggested");
  });
});
