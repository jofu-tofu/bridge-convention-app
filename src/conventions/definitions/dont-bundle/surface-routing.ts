import type { Auction, Seat } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { RoutedSurfaceGroup } from "../../core/bundle/bundle-types";
import { auctionMatchesPrefix } from "../../../engine/auction-helpers";
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
} from "./meaning-surfaces";

/**
 * Machine-only surface groups: relay response surfaces are only routed via
 * the conversation machine. These groups exist for registry completeness but
 * emit no surfaces through the fallback router.
 */
const MACHINE_ONLY: readonly MeaningSurface[] = [];

/**
 * Routed surface groups for the DONT bundle.
 *
 * R1 surfaces are wired for both machine and fallback router paths.
 * Advancer surfaces are wired for both paths.
 * Reveal and relay response surfaces are routed exclusively via the machine.
 */
export const DONT_ROUTED_SURFACES: readonly RoutedSurfaceGroup[] = [
  // ── R1: Overcaller DONT actions after opponent's 1NT ────────
  {
    groupId: "overcaller-r1",
    surfaces: DONT_R1_SURFACES,
    isActive: (auction, seat) => {
      // Active when 1NT has been bid and it's overcaller's turn
      return (
        auctionMatchesPrefix(auction, ["1NT"]) &&
        auction.entries.length === 1 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },

  // ── Advancer surfaces after each overcaller action ──────────
  {
    groupId: "advancer-after-2h",
    surfaces: DONT_ADVANCER_2H_SURFACES,
    isActive: (auction, _seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2H", "P"]) &&
        auction.entries.length === 3
      );
    },
  },
  {
    groupId: "advancer-after-2d",
    surfaces: DONT_ADVANCER_2D_SURFACES,
    isActive: (auction, _seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2D", "P"]) &&
        auction.entries.length === 3
      );
    },
  },
  {
    groupId: "advancer-after-2c",
    surfaces: DONT_ADVANCER_2C_SURFACES,
    isActive: (auction, _seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2C", "P"]) &&
        auction.entries.length === 3
      );
    },
  },
  {
    groupId: "advancer-after-2s",
    surfaces: DONT_ADVANCER_2S_SURFACES,
    isActive: (auction, _seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2S", "P"]) &&
        auction.entries.length === 3
      );
    },
  },
  {
    groupId: "advancer-after-double",
    surfaces: DONT_ADVANCER_DOUBLE_SURFACES,
    isActive: (auction, _seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "X", "P"]) &&
        auction.entries.length === 3
      );
    },
  },

  // ── Machine-only: Overcaller reveal + relay responses ───────
  {
    groupId: "overcaller-reveal",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "X", "P", "2C", "P"]) &&
        auction.entries.length === 5 &&
        seat === auction.entries[1]!.seat
      );
    },
  },
  {
    groupId: "overcaller-2c-relay",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2C", "P", "2D", "P"]) &&
        auction.entries.length === 5 &&
        seat === auction.entries[1]!.seat
      );
    },
  },
  {
    groupId: "overcaller-2d-relay",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["1NT", "2D", "P", "2H", "P"]) &&
        auction.entries.length === 5 &&
        seat === auction.entries[1]!.seat
      );
    },
  },
];

/**
 * Create a surface router from routed surface groups.
 */
export function createDontSurfaceRouter(
  routedGroups: readonly RoutedSurfaceGroup[],
): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  return (auction, seat) => {
    const activeGroups = routedGroups.filter((g) => g.isActive?.(auction, seat));
    return activeGroups.flatMap((g) => g.surfaces);
  };
}
