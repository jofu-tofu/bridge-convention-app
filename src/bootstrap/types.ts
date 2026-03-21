import type { Hand, Auction, Seat, Deal } from "../engine/types";
import type {
  BiddingStrategy,
  BidResult,
  PlayStrategy,
  ConventionBiddingStrategy,
} from "../core/contracts";
import type { InferenceConfig } from "../inference/types";
import type { InferenceEngine } from "../inference/inference-engine";

// Re-export drill tuning types from contracts so existing importers continue to work
export { DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS } from "../core/contracts/drill";
export type { OpponentMode, VulnerabilityDistribution, DrillTuning, DrillSettings } from "../core/contracts/drill";
export { DEFAULT_DISPLAY_PREFERENCES as DEFAULT_DISPLAY_SETTINGS } from "../core/contracts/practice-preferences";
export type { DisplayPreferences as DisplaySettings } from "../core/contracts/practice-preferences";

// ─── Drill config ───────────────────────────────────────────

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
  /** True when this deal was generated as an off-convention hand
   *  (the convention doesn't apply; user should bid naturally). */
  isOffConvention?: boolean;
}
