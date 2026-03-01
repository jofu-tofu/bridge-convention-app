import { Seat, Suit } from "../../../engine/types";
import type { DealConstraints, Auction } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { weakTwosProtocol } from "./tree";
import { weakTwosExplanations } from "./explanations";
import { weakTwoTransitionRules } from "./transitions";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { weakTwoResolvers } from "./resolvers";

// ─── Deal Constraints ─────────────────────────────────────────

/** Weak Two deal constraints: opener 5-11 HCP with 6+ in H/S/D, responder 10+ HCP. */
export const weakTwosDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 5,
      maxHcp: 11,
      minLengthAny: {
        [Suit.Hearts]: 6,
        [Suit.Spades]: 6,
        [Suit.Diamonds]: 6,
      },
    },
    {
      seat: Seat.South,
      minHcp: 10,
    },
  ],
  dealer: Seat.North,
};

// ─── Default Auction ──────────────────────────────────────────

/** Opener is first to act — empty auction. */
function weakTwosDefaultAuction(
  _seat: Seat,
  _deal?: import("../../../engine/types").Deal,
): Auction | undefined {
  // Opener is North and goes first; no preceding bids needed.
  return undefined;
}

// ─── Convention Config ────────────────────────────────────────

export const weakTwosConfig: ConventionConfig = {
  id: "weak-twos",
  name: "Weak Two Bids",
  description:
    "Preemptive opening bids showing a 6-card suit and 5-11 HCP, with Ogust 2NT inquiry",
  category: ConventionCategory.Constructive,
  dealConstraints: weakTwosDealConstraints,
  protocol: weakTwosProtocol,
  explanations: weakTwosExplanations,
  defaultAuction: weakTwosDefaultAuction,
  allowedDealers: [Seat.North],
  transitionRules: weakTwoTransitionRules,
  baselineRules: baselineTransitionRules,
  intentResolvers: weakTwoResolvers,
};
