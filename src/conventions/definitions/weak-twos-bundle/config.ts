import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_WEAK_TWO } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { WEAK_TWO_PROFILE } from "./system-profile";
import { WEAK_TWO_ALTERNATIVE_GROUPS } from "./alternatives";

const weakTwoBundleDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 5,
      maxHcp: 11,
      minLengthAny: {
        [Suit.Diamonds]: 6,
        [Suit.Hearts]: 6,
        [Suit.Spades]: 6,
      },
    },
    {
      seat: Seat.South,
      minHcp: 14,
    },
  ],
  dealer: Seat.North,
};

/**
 * Minimal ConventionBundle for legacy registration.
 * Strategy is now handled by the protocol frame architecture (convention-spec.ts).
 */
export const weakTwoBundle: ConventionBundle = {
  id: "weak-two-bundle",
  name: "Weak Two Bids Bundle",
  description: "Weak Two Bids with Ogust 2NT response system",
  category: ConventionCategory.Constructive,
  memberIds: ["weak-two-bundle", "weak-twos"],
  dealConstraints: weakTwoBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["2H", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_WEAK_TWO]: "active" },
  systemProfile: WEAK_TWO_PROFILE,
  acceptableAlternatives: WEAK_TWO_ALTERNATIVE_GROUPS,
};
