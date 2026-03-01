import { describe, it, expect } from "vitest";
import type { BiddingStrategy, BidResult } from "../../shared/types";
import type { BiddingContext } from "../../conventions/core/types";
import { createStrategyChain } from "../bidding/strategy-chain";

function stubStrategy(
  id: string,
  result: BidResult | null,
): BiddingStrategy {
  return {
    id,
    name: `Stub ${id}`,
    suggest: () => result,
  };
}

const dummyResult: BidResult = {
  call: { type: "bid", level: 1, strain: "NT" as never },
  ruleName: "test-rule",
  explanation: "test explanation",
};

const secondResult: BidResult = {
  call: { type: "pass" },
  ruleName: null,
  explanation: "fallback",
};

describe("createStrategyChain", () => {
  it("delegates to first strategy when it returns a result", () => {
    const chain = createStrategyChain([
      stubStrategy("first", dummyResult),
      stubStrategy("second", secondResult),
    ]);

    const result = chain.suggest({} as BiddingContext);

    expect(result!.call).toEqual(dummyResult.call);
    expect(result!.ruleName).toBe(dummyResult.ruleName);
    expect(result!.explanation).toBe(dummyResult.explanation);
  });

  it("falls through null to next strategy", () => {
    const chain = createStrategyChain([
      stubStrategy("first", null),
      stubStrategy("second", secondResult),
    ]);

    const result = chain.suggest({} as BiddingContext);

    expect(result!.call).toEqual(secondResult.call);
    expect(result!.ruleName).toBe(secondResult.ruleName);
  });

  it("returns null when all strategies return null", () => {
    const chain = createStrategyChain([
      stubStrategy("first", null),
      stubStrategy("second", null),
    ]);

    const result = chain.suggest({} as BiddingContext);

    expect(result).toBeNull();
  });

  it("builds id from constituent strategy ids", () => {
    const chain = createStrategyChain([
      stubStrategy("a", null),
      stubStrategy("b", null),
    ]);

    expect(chain.id).toBe("chain:a+b");
  });

  it("builds name from constituent strategy names", () => {
    const chain = createStrategyChain([
      stubStrategy("a", null),
      stubStrategy("b", null),
    ]);

    expect(chain.name).toBe("Chain(Stub a, Stub b)");
  });
});
