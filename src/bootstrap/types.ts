import type { Hand, Auction, Seat, Deal } from "../engine/types";
import type {
  BiddingStrategy,
  BidResult,
  PlayStrategy,
  ConventionBiddingStrategy,
} from "../core/contracts";
import type { InferenceConfig } from "../inference/types";
import type { InferenceEngine } from "../inference/inference-engine";

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

export interface DrillBundle {
  deal: Deal;
  session: DrillSession;
  initialAuction?: Auction;
  strategy?: ConventionBiddingStrategy;
  nsInferenceEngine: InferenceEngine | null;
  ewInferenceEngine: InferenceEngine | null;
}
