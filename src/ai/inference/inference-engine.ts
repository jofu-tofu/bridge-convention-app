import type { InferenceConfig, InferredHoldings, HandInference } from "./types";
import type { Auction, AuctionEntry, Seat } from "../../engine/types";
import type { InferenceSnapshot } from "./types";
import { Seat as SeatEnum } from "../../engine/types";
import { partnerSeat } from "../../engine/constants";
import { mergeInferences } from "./merge";

const ALL_SEATS: Seat[] = [
  SeatEnum.North,
  SeatEnum.East,
  SeatEnum.South,
  SeatEnum.West,
];

function isOwnPartnership(observerSeat: Seat, bidderSeat: Seat): boolean {
  return (
    bidderSeat === observerSeat ||
    bidderSeat === partnerSeat(observerSeat)
  );
}

export interface InferenceEngine {
  /** Process a single bid and update inferences. */
  processBid(entry: AuctionEntry, auctionBefore: Auction): void;
  /** Get merged inferences for all seats. */
  getInferences(): Record<Seat, InferredHoldings>;
  /** Get per-bid inference timeline snapshots. */
  getTimeline(): readonly InferenceSnapshot[];
  /** Clear all accumulated inferences. */
  reset(): void;
}

/**
 * Create an incremental inference engine.
 * Uses asymmetric providers: own partnership uses convention-aware inference,
 * opponent partnership uses natural bidding theory.
 */
export function createInferenceEngine(
  config: InferenceConfig,
  observerSeat: Seat,
): InferenceEngine {
  const rawInferences: Record<Seat, HandInference[]> = {
    [SeatEnum.North]: [],
    [SeatEnum.East]: [],
    [SeatEnum.South]: [],
    [SeatEnum.West]: [],
  };

  // Always-on: timeline resets per engine reset, max ~12 entries per auction.
  // Used by DebugDrawer now and future play review features.
  const timeline: InferenceSnapshot[] = [];

  function computeInferences(): Record<Seat, InferredHoldings> {
    return {
      [SeatEnum.North]: mergeInferences(SeatEnum.North, rawInferences[SeatEnum.North]),
      [SeatEnum.East]: mergeInferences(SeatEnum.East, rawInferences[SeatEnum.East]),
      [SeatEnum.South]: mergeInferences(SeatEnum.South, rawInferences[SeatEnum.South]),
      [SeatEnum.West]: mergeInferences(SeatEnum.West, rawInferences[SeatEnum.West]),
    };
  }

  return {
    processBid(entry: AuctionEntry, auctionBefore: Auction): void {
      const bidderSeat = entry.seat;
      const provider = isOwnPartnership(observerSeat, bidderSeat)
        ? config.ownPartnership
        : config.opponentPartnership;

      let newInference: HandInference | null = null;
      try {
        newInference = provider.inferFromBid(
          entry,
          auctionBefore,
          bidderSeat,
        ) ?? null;
        if (newInference) {
          rawInferences[bidderSeat].push(newInference);
        }
      } catch {
        // Inference errors are silently swallowed — never thrown to callers
      }
      timeline.push({ entry, newInference, cumulativeInferences: computeInferences() });
    },

    getInferences(): Record<Seat, InferredHoldings> {
      return computeInferences();
    },

    getTimeline(): readonly InferenceSnapshot[] {
      return timeline;
    },

    reset(): void {
      for (const seat of ALL_SEATS) {
        rawInferences[seat] = [];
      }
      timeline.length = 0;
    },
  };
}
