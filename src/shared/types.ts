import type { Call } from "../engine/types";
import type { BiddingContext } from "../conventions/types";

export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly confidence?: number; // 0-1, future use (ML strategies)
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}
