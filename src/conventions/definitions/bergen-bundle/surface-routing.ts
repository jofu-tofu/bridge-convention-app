import type { Auction, Seat } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
} from "./meaning-surfaces";

/** A surface group with its activation pattern. */
export interface BergenRoutedSurfaceGroup {
  readonly groupId: string;
  readonly surfaces: readonly MeaningSurface[];
  readonly isActive: (auction: Auction, seat: Seat) => boolean;
}

/**
 * Check whether the auction entries match an expected sequence of call strings.
 */
function auctionMatchesSequence(
  auction: Auction,
  expected: readonly string[],
): boolean {
  if (auction.entries.length < expected.length) return false;

  for (let i = 0; i < expected.length; i++) {
    const entry = auction.entries[i]!;
    const exp = expected[i]!;

    if (exp === "P") {
      if (entry.call.type !== "pass") return false;
      continue;
    }

    if (entry.call.type !== "bid") return false;

    const match = exp.match(/^(\d)(NT|C|D|H|S)$/);
    if (!match) return false;

    const level = Number(match[1]);
    const strainMap: Record<string, BidSuit> = {
      C: BidSuit.Clubs,
      D: BidSuit.Diamonds,
      H: BidSuit.Hearts,
      S: BidSuit.Spades,
      NT: BidSuit.NoTrump,
    };
    const strain = strainMap[match[2]!];
    if (entry.call.level !== level || entry.call.strain !== strain) return false;
  }

  return true;
}

/**
 * Routed surface groups for the Bergen Raises bundle.
 * Two groups: responder R1 for hearts and spades.
 */
export const BERGEN_ROUTED_SURFACES: readonly BergenRoutedSurfaceGroup[] = [
  {
    groupId: "responder-r1-hearts",
    surfaces: BERGEN_R1_HEARTS_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P, for the responder (not the opener)
      return (
        auctionMatchesSequence(auction, ["1H", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-r1-spades",
    surfaces: BERGEN_R1_SPADES_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P, for the responder (not the opener)
      return (
        auctionMatchesSequence(auction, ["1S", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
];

/**
 * Create a surface router from routed surface groups.
 */
export function createBergenSurfaceRouter(
  routedGroups: readonly BergenRoutedSurfaceGroup[],
): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  return (auction, seat) => {
    const activeGroups = routedGroups.filter((g) => g.isActive(auction, seat));
    return activeGroups.flatMap((g) => g.surfaces);
  };
}
