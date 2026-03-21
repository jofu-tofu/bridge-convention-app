import type { InferenceConfig, PublicBeliefs } from "./types";
import type { Auction, AuctionEntry, Seat } from "../engine/types";
import type { InferenceSnapshot } from "./types";
import type { FactConstraint } from "../core/contracts/agreement-module";
import { Seat as SeatEnum } from "../engine/types";
import { partnerSeat } from "../engine/constants";
import { derivePublicBeliefs, handInferenceToConstraints } from "./derive-beliefs";

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
  /** Get derived public beliefs for all seats. */
  getBeliefs(): Record<Seat, PublicBeliefs>;
  /** Get per-bid inference timeline snapshots. */
  getTimeline(): readonly InferenceSnapshot[];
  /** Clear all accumulated constraints. */
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
  const rawConstraints: Record<Seat, FactConstraint[]> = {
    [SeatEnum.North]: [],
    [SeatEnum.East]: [],
    [SeatEnum.South]: [],
    [SeatEnum.West]: [],
  };

  // Always-on: timeline resets per engine reset, max ~12 entries per auction.
  // Used by DebugDrawer now and future play review features.
  const timeline: InferenceSnapshot[] = [];

  function computeBeliefs(): Record<Seat, PublicBeliefs> {
    return {
      [SeatEnum.North]: derivePublicBeliefs(SeatEnum.North, rawConstraints[SeatEnum.North]),
      [SeatEnum.East]: derivePublicBeliefs(SeatEnum.East, rawConstraints[SeatEnum.East]),
      [SeatEnum.South]: derivePublicBeliefs(SeatEnum.South, rawConstraints[SeatEnum.South]),
      [SeatEnum.West]: derivePublicBeliefs(SeatEnum.West, rawConstraints[SeatEnum.West]),
    };
  }

  return {
    processBid(entry: AuctionEntry, auctionBefore: Auction): void {
      const bidderSeat = entry.seat;
      const provider = isOwnPartnership(observerSeat, bidderSeat)
        ? config.ownPartnership
        : config.opponentPartnership;

      let newConstraints: readonly FactConstraint[] = [];
      try {
        const inference = provider.inferFromBid(entry, auctionBefore, bidderSeat) ?? null;
        if (inference) {
          newConstraints = handInferenceToConstraints(inference);
          rawConstraints[bidderSeat].push(...newConstraints);
        }
      } catch {
        // Inference errors are silently swallowed — never thrown to callers
      }
      timeline.push({ entry, newConstraints, cumulativeBeliefs: computeBeliefs() });
    },

    getBeliefs(): Record<Seat, PublicBeliefs> {
      return computeBeliefs();
    },

    getTimeline(): readonly InferenceSnapshot[] {
      return timeline;
    },

    reset(): void {
      for (const seat of ALL_SEATS) {
        rawConstraints[seat] = [];
      }
      timeline.length = 0;
    },
  };
}
