import type { RoutedSurfaceGroup } from "../../core/bundle/bundle-types";
import { auctionMatchesPrefix } from "../../../engine/auction-helpers";
import { MACHINE_ONLY } from "../../core/surface-helpers";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
} from "./meaning-surfaces";

/**
 * Routed surface groups for the Weak Two Bids bundle.
 *
 * R1 surfaces are wired for both machine and fallback router paths.
 * R2 surfaces are wired for both paths (responder needs them after 2X-P).
 * Ogust R3 surfaces are routed exclusively via the conversation machine.
 */
export const WEAK_TWO_ROUTED_SURFACES: readonly RoutedSurfaceGroup[] = [
  // ── R1: Opener weak two surfaces ────────────────────────────
  {
    groupId: "opener-r1",
    surfaces: WEAK_TWO_R1_SURFACES,
    isActive: (auction, _seat) => {
      // Active when auction is empty (opener needs to decide)
      return auction.entries.length === 0;
    },
  },

  // ── R2: Responder actions after 2H-P ────────────────────────
  {
    groupId: "responder-r2-hearts",
    surfaces: WEAK_TWO_R2_HEARTS_SURFACES,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2H", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-r2-spades",
    surfaces: WEAK_TWO_R2_SPADES_SURFACES,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2S", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-r2-diamonds",
    surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2D", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },

  // ── R3: Ogust response surfaces (machine-only) ─────────────
  {
    groupId: "ogust-response-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2H", "P", "2NT", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "ogust-response-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2S", "P", "2NT", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "ogust-response-diamonds",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      return (
        auctionMatchesPrefix(auction, ["2D", "P", "2NT", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
];

/**
 * Create a surface router from routed surface groups.
 */
export { createFallbackSurfaceRouter as createWeakTwoSurfaceRouter } from "../../core/surface-helpers";
