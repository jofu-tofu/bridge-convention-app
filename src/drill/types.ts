import type { Hand, Auction, Seat } from "../engine/types";
import type {
  BiddingStrategy,
  BidResult,
  PlayStrategy,
} from "../shared/types";
import type { InferenceConfig } from "../inference/types";

export interface DrillConfig {
  readonly conventionId: string;
  readonly userSeat: Seat;
  readonly seatStrategies: Record<Seat, BiddingStrategy | "user">;
  readonly playStrategy?: PlayStrategy;
  readonly nsInferenceConfig?: InferenceConfig;
  readonly ewInferenceConfig?: InferenceConfig;
}

export interface DrillSession {
  readonly config: DrillConfig;
  getNextBid(seat: Seat, hand: Hand, auction: Auction): BidResult | null;
  isUserSeat(seat: Seat): boolean;
}
