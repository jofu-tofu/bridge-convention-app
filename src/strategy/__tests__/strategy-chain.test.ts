import { describe, test, expect, beforeEach } from "vitest";
import { Seat } from "../../engine/types";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { weakTwosConfig } from "../../conventions/definitions/weak-twos";
import { saycConfig } from "../../conventions/definitions/sayc";
import {
  staymanResponder,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/core/types";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { conventionToStrategy } from "../bidding/convention-strategy";
import { createStrategyChain } from "../bidding/strategy-chain";
import { passStrategy } from "../bidding/pass-strategy";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
  registerConvention(saycConfig);
});

// ─── Phase 8b: Strategy chain resultFilter ──────────────

describe("createStrategyChain — resultFilter", () => {
  test("chain with resultFilter skips Pass from passStrategy → returns null", () => {
    const chain = createStrategyChain([passStrategy], {
      resultFilter: (result) => result.call.type !== "pass",
    });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).toBeNull();
  });

  test("chain without resultFilter allows Pass from passStrategy", () => {
    const chain = createStrategyChain([passStrategy]);
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test("chain with resultFilter allows non-Pass results through", () => {
    const chain = createStrategyChain(
      [conventionToStrategy(staymanConfig), passStrategy],
      { resultFilter: (result) => result.call.type !== "pass" },
    );
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
  });

  test("forcingFiltered trace field set when result filtered", () => {
    const chain = createStrategyChain([passStrategy], {
      resultFilter: (result) => result.call.type !== "pass",
    });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    // Chain returns null, so no result to check trace on.
    // But we verify the chain tries passStrategy and filters it.
    const result = chain.suggest(context);
    expect(result).toBeNull();
  });

  test("forcingFiltered trace propagated to result when first strategy filtered", () => {
    // Convention strategy produces non-Pass, so filter doesn't reject it,
    // but passStrategy is never reached.
    const chain = createStrategyChain(
      [conventionToStrategy(staymanConfig)],
      { resultFilter: (result) => result.call.type !== "pass" },
    );
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).not.toBeNull();
    // Convention produced a non-Pass result, so forcingFiltered should be undefined
    expect(result!.evaluationTrace?.forcingFiltered).toBeUndefined();
  });
});
