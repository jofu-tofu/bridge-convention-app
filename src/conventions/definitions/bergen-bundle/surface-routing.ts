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

// TODO: Import R2 surfaces when meaning-surfaces.ts is updated by the surfaces subagent
// import {
//   BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
//   BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
//   BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
//   BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
//   BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
//   BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
//   BERGEN_R3_ACCEPT_SURFACES,
//   BERGEN_R4_ACCEPT_SURFACES,
// } from "./meaning-surfaces";

/** Placeholder: empty surface array until R2-R4 surfaces are created. */
const PENDING_SURFACES: readonly MeaningSurface[] = [];

/**
 * Routed surface groups for the Bergen Raises bundle.
 *
 * R1: Responder initial bids after 1M-P (hearts and spades).
 * R2: Opener rebids after responder's Bergen raise (6 groups: 3 raise types × 2 suits).
 * R3: Responder continuations after opener's rebid (suit-independent acceptance).
 * R4: Opener final acceptance after responder's game-try decision.
 *
 * The machine handles surface selection via surfaceGroupId, so this router
 * is a FALLBACK for when the machine isn't used.
 */
export const BERGEN_ROUTED_SURFACES: readonly BergenRoutedSurfaceGroup[] = [
  // ── R1: Responder initial bids ──────────────────────────────
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

  // ── R2: Opener rebids after constructive raise (3C) ─────────
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES
  {
    groupId: "opener-after-constructive-hearts",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P-3C-P, for the opener (same seat as 1H bidder)
      return (
        auctionMatchesSequence(auction, ["1H", "P", "3C", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES
  {
    groupId: "opener-after-constructive-spades",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P-3C-P, for the opener (same seat as 1S bidder)
      return (
        auctionMatchesSequence(auction, ["1S", "P", "3C", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R2: Opener rebids after limit raise (3D) ───────────────
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES
  {
    groupId: "opener-after-limit-hearts",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P-3D-P, for the opener
      return (
        auctionMatchesSequence(auction, ["1H", "P", "3D", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES
  {
    groupId: "opener-after-limit-spades",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P-3D-P, for the opener
      return (
        auctionMatchesSequence(auction, ["1S", "P", "3D", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R2: Opener rebids after preemptive raise (3M) ──────────
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES
  {
    groupId: "opener-after-preemptive-hearts",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P-3H-P, for the opener
      return (
        auctionMatchesSequence(auction, ["1H", "P", "3H", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES
  {
    groupId: "opener-after-preemptive-spades",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P-3S-P, for the opener
      return (
        auctionMatchesSequence(auction, ["1S", "P", "3S", "P"]) &&
        auction.entries.length === 4 &&
        seat === auction.entries[0]!.seat
      );
    },
  },

  // ── R3: Responder continuations after opener's rebid ────────
  // These cover: accept game, accept signoff, try-accept, try-reject.
  // Suit-independent (pass surfaces) — keyed by opener's action, not suit.
  // TODO: Replace PENDING_SURFACES with BERGEN_R3_ACCEPT_SURFACES
  {
    groupId: "responder-after-game-hearts",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P-{3C/3D}-P-4H-P, for the responder
      // Opener bid game (4H) following constructive or limit raise
      return (
        auction.entries.length === 6 &&
        (auctionMatchesSequence(auction, ["1H", "P", "3C", "P", "4H", "P"]) ||
         auctionMatchesSequence(auction, ["1H", "P", "3D", "P", "4H", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R3_ACCEPT_SURFACES
  {
    groupId: "responder-after-game-spades",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P-{3C/3D}-P-4S-P, for the responder
      return (
        auction.entries.length === 6 &&
        (auctionMatchesSequence(auction, ["1S", "P", "3C", "P", "4S", "P"]) ||
         auctionMatchesSequence(auction, ["1S", "P", "3D", "P", "4S", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R3_ACCEPT_SURFACES
  {
    groupId: "responder-after-signoff-hearts",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1H-P-{3C/3D}-P-3H-P, for the responder
      // Opener signed off at 3H following constructive or limit raise
      return (
        auction.entries.length === 6 &&
        (auctionMatchesSequence(auction, ["1H", "P", "3C", "P", "3H", "P"]) ||
         auctionMatchesSequence(auction, ["1H", "P", "3D", "P", "3H", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },
  // TODO: Replace PENDING_SURFACES with BERGEN_R3_ACCEPT_SURFACES
  {
    groupId: "responder-after-signoff-spades",
    surfaces: PENDING_SURFACES,
    isActive: (auction, seat) => {
      // Active after 1S-P-{3C/3D}-P-3S-P, for the responder
      return (
        auction.entries.length === 6 &&
        (auctionMatchesSequence(auction, ["1S", "P", "3C", "P", "3S", "P"]) ||
         auctionMatchesSequence(auction, ["1S", "P", "3D", "P", "3S", "P"])) &&
        seat !== auction.entries[0]!.seat
      );
    },
  },

  // ── R4: Opener final acceptance after game try ──────────────
  // After responder accepted/rejected a game try following constructive raise.
  // TODO: Replace PENDING_SURFACES with BERGEN_R4_ACCEPT_SURFACES
  // Note: R4 routing is complex (opener accepts after any game-try response).
  // The machine handles this; the router is intentionally simplified.
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
