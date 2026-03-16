import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_WEAK_TWO } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { WEAK_TWO_PROFILE } from "./system-profile";
import { WEAK_TWO_ALTERNATIVE_GROUPS } from "./alternatives";
import { compileProfileFromPackages } from "../../core/composition/compile-from-packages";
import { WEAK_TWO_SKELETON } from "./compose";
import { weakTwoPackage } from "./packages/weak-two";

const composed = compileProfileFromPackages(
  WEAK_TWO_PROFILE,
  [weakTwoPackage],
  {
    machineId: WEAK_TWO_SKELETON.machineId,
    skeletonStates: WEAK_TWO_SKELETON.states,
    dispatchStateId: WEAK_TWO_SKELETON.dispatchStateId,
    entrySurfaceGroupId: WEAK_TWO_SKELETON.entrySurfaceGroupId,
  },
);

const weakTwoBundleDealConstraints: DealConstraints = {
  seats: [
    // North = opener: 5-11 HCP, 6+ in any of D/H/S
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
    // South = responder: 14+ HCP
    {
      seat: Seat.South,
      minHcp: 14,
    },
  ],
  dealer: Seat.North,
};

export const weakTwoBundle = createBundle({
  id: "weak-two-bundle",
  name: "Weak Two Bids Bundle",
  description: "Weak Two Bids with Ogust 2NT response system",
  category: ConventionCategory.Constructive,
  memberIds: ["weak-two-bundle", "weak-twos"],
  composed,
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
});
