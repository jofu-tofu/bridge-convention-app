import type { InferenceConfig, InferredHoldings, HandInference } from "./types";
import type { Auction, AuctionEntry, Seat } from "../../engine/types";
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

  return {
    processBid(entry: AuctionEntry, auctionBefore: Auction): void {
      const bidderSeat = entry.seat;
      const provider = isOwnPartnership(observerSeat, bidderSeat)
        ? config.ownPartnership
        : config.opponentPartnership;

      try {
        const inference = provider.inferFromBid(
          entry,
          auctionBefore,
          bidderSeat,
        );
        if (inference) {
          rawInferences[bidderSeat].push(inference);
        }
      } catch {
        // Inference errors are silently swallowed — never thrown to callers
      }
    },

    getInferences(): Record<Seat, InferredHoldings> {
      const result = {} as Record<Seat, InferredHoldings>;
      for (const seat of ALL_SEATS) {
        result[seat] = mergeInferences(seat, rawInferences[seat]);
      }
      return result;
    },

    reset(): void {
      for (const seat of ALL_SEATS) {
        rawInferences[seat] = [];
      }
    },
  };
}
