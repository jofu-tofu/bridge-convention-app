// Evaluation trace tests
// Verifies that the EvaluationTrace DTO captures pipeline events.

import { describe, test, expect } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { buildAuction } from "../../../engine/auction-helpers";
import { createStrategyChain } from "../../../session/heuristics/strategy-chain";
import { TraceCollector } from "../trace-collector";
import type { BiddingStrategy, BidResult } from "../../core/strategy-types";
import type { BiddingContext } from "../../core/strategy-types";

describe("TraceCollector", () => {
  test("builds an EvaluationTrace with all fields", () => {
    const tc = new TraceCollector();
    tc.setConventionId("stayman");
    tc.setCandidateCount(3);
    tc.addStrategyAttempt("convention:stayman", "suggested");

    const trace = tc.build();
    expect(trace.conventionId).toBe("stayman");
    expect(trace.candidateCount).toBe(3);
    expect(trace.strategyChainPath).toHaveLength(1);
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
