import type { BiddingStrategy, BidResult } from "../../conventions/core/strategy-types";

export const passStrategy: BiddingStrategy = {
  id: "pass",
  name: "Always Pass",
  suggest(): BidResult {
    return {
      call: { type: "pass" },
      ruleName: null,
      explanation: "Always passes (placeholder strategy)",
    };
  },
};
