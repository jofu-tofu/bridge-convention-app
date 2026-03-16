import type { RoutedSurfaceGroup } from "../../core/bundle/bundle-types";
import { auctionMatchesPrefix } from "../../../engine/auction-helpers";
import { MACHINE_ONLY } from "../../core/surface-helpers";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
} from "./meaning-surfaces";

/**
 * Routed surface groups for the Bergen Raises bundle.
 *
 * R1 surfaces are fully wired for both machine and fallback router paths.
 * R2-R4 surfaces are routed exclusively via the conversation machine
 * (surfaceGroupId on machine states). The fallback router entries exist
 * for structural completeness but emit no surfaces.
 */
export const BERGEN_ROUTED_SURFACES: readonly RoutedSurfaceGroup[] = [
  // ── R1: Responder initial bids ──────────────────────────────
  {
    groupId: "responder-r1-hearts",
    surfaces: BERGEN_R1_HEARTS_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P, for the responder (not the opener)
      return (
        auctionMatchesPrefix(auction, ["1H", "P"]) &&
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
        auctionMatchesPrefix(auction, ["1S", "P"]) &&
        auction.entries.length === 2 &&
        seat !== auction.entries[0]!.seat
      );
    },
  },

  // ── R2: Opener rebids after constructive raise (3C) ─────────
  {
    groupId: "opener-after-constructive-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1H-P-3C-P, for the opener (same seat as 1H bidder)
      return (
        auctionMatchesPrefix(auction, ["1H", "P", "3C", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "opener-after-constructive-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1S-P-3C-P, for the opener (same seat as 1S bidder)
      return (
        auctionMatchesPrefix(auction, ["1S", "P", "3C", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R2: Opener rebids after limit raise (3D) ───────────────
  {
    groupId: "opener-after-limit-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1H-P-3D-P, for the opener
      return (
        auctionMatchesPrefix(auction, ["1H", "P", "3D", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "opener-after-limit-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1S-P-3D-P, for the opener
      return (
        auctionMatchesPrefix(auction, ["1S", "P", "3D", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R2: Opener rebids after preemptive raise (3M) ──────────
  {
    groupId: "opener-after-preemptive-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1H-P-3H-P, for the opener
      return (
        auctionMatchesPrefix(auction, ["1H", "P", "3H", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "opener-after-preemptive-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1S-P-3S-P, for the opener
      return (
        auctionMatchesPrefix(auction, ["1S", "P", "3S", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R3: Responder continuations after opener's rebid ────────
  // These cover: accept game, accept signoff, try-accept, try-reject.
  // Suit-independent (pass surfaces) — keyed by opener's action, not suit.
  {
    groupId: "responder-after-game-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1H-P-{3C/3D}-P-4H-P, for the responder
      // Opener bid game (4H) following constructive or limit raise
      return (
        auction.entries.length === 6 &&
        (auctionMatchesPrefix(auction, ["1H", "P", "3C", "P", "4H", "P"]) ||
         auctionMatchesPrefix(auction, ["1H", "P", "3D", "P", "4H", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-after-game-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1S-P-{3C/3D}-P-4S-P, for the responder
      return (
        auction.entries.length === 6 &&
        (auctionMatchesPrefix(auction, ["1S", "P", "3C", "P", "4S", "P"]) ||
         auctionMatchesPrefix(auction, ["1S", "P", "3D", "P", "4S", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-after-signoff-hearts",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1H-P-{3C/3D}-P-3H-P, for the responder
      // Opener signed off at 3H following constructive or limit raise
      return (
        auction.entries.length === 6 &&
        (auctionMatchesPrefix(auction, ["1H", "P", "3C", "P", "3H", "P"]) ||
         auctionMatchesPrefix(auction, ["1H", "P", "3D", "P", "3H", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  {
    groupId: "responder-after-signoff-spades",
    surfaces: MACHINE_ONLY,
    isActive: (auction, seat) => {
      // Active after 1S-P-{3C/3D}-P-3S-P, for the responder
      return (
        auction.entries.length === 6 &&
        (auctionMatchesPrefix(auction, ["1S", "P", "3C", "P", "3S", "P"]) ||
         auctionMatchesPrefix(auction, ["1S", "P", "3D", "P", "3S", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },

  // ── R4: Opener final acceptance after game try ──────────────
  // After responder accepted/rejected a game try following constructive raise.
  // The machine handles this; the router is intentionally simplified.
];

/**
 * Create a surface router from routed surface groups.
 */
export { createFallbackSurfaceRouter as createBergenSurfaceRouter } from "../../core/surface-helpers";
