import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPPONENT_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { compileProfileFromPackages } from "../../core/composition/compile-from-packages";
import { DONT_SKELETON } from "./compose";
import { DONT_PROFILE } from "./system-profile";
import { DONT_ALTERNATIVE_GROUPS } from "./alternatives";
import { dontPackage } from "./packages/dont";

const composed = compileProfileFromPackages(
  DONT_PROFILE,
  [dontPackage],
  {
    machineId: DONT_SKELETON.machineId,
    skeletonStates: DONT_SKELETON.states,
    dispatchStateId: DONT_SKELETON.dispatchStateId,
    entrySurfaceGroupId: DONT_SKELETON.entrySurfaceGroupId,
  },
);

const dontBundleDealConstraints: DealConstraints = {
  seats: [
    // East = opener: 15-17 HCP, balanced (1NT opener)
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
    },
    // South = overcaller: 8+ HCP, at least one 5+ card suit for DONT
    {
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 15,
      minLengthAny: {
        [Suit.Clubs]: 5,
        [Suit.Diamonds]: 5,
        [Suit.Hearts]: 5,
        [Suit.Spades]: 5,
      },
    },
  ],
  dealer: Seat.East,
};

export const dontBundle = createBundle({
  id: "dont-bundle",
  name: "DONT Bundle",
  description:
    "DONT (Disturbing Opponent's No Trump) — competitive overcalls after opponent's 1NT",
  category: ConventionCategory.Defensive,
  memberIds: ["dont-bundle", "dont"],
  composed,
  declaredCapabilities: { [CAP_OPPONENT_1NT]: "active" },
  dealConstraints: dontBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.West) {
      return buildAuction(Seat.East, ["1NT"]);
    }
    return undefined;
  },
  systemProfile: DONT_PROFILE,
  acceptableAlternatives: DONT_ALTERNATIVE_GROUPS,
});
