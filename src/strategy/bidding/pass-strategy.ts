import type { BiddingStrategy, BidResult } from "../../contracts";

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
