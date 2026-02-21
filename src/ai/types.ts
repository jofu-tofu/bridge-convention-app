import type { Hand, Auction, Seat } from "../engine/types";
import type { BiddingStrategy, BidResult } from "../shared/types";

// Phase 4 types — defined now, implemented later
export interface DrillConfig {
  readonly conventionId: string;
  readonly userSeat: Seat;
  readonly seatStrategies: Record<Seat, BiddingStrategy | "user">;
}

export interface DrillSession {
  readonly config: DrillConfig;
  getNextBid(seat: Seat, hand: Hand, auction: Auction): BidResult | null;
  isUserSeat(seat: Seat): boolean;
}
