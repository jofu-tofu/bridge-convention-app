import { Seat, Suit } from "../../../engine/types";
import type { Auction, Deal, DealConstraints } from "../../../engine/types";
import type { AlternativeGroup } from "../../../core/contracts";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { lebensohlLiteProtocol } from "./tree";
import { lebensohlLiteExplanations } from "./explanations";
import { lebensohlTransitionRules } from "./transitions";
import { lebensohlResolvers } from "./resolvers";

export const lebensohlLiteDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
      maxLength: {
        [Suit.Spades]: 4,
        [Suit.Hearts]: 4,
      },
    },
    {
      seat: Seat.South,
      minHcp: 0,
    },
  ],
  dealer: Seat.North,
};

function lebensohlLiteDefaultAuction(
  seat: Seat,
  _deal?: Deal,
): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.North, ["1NT", "2D"]);
  }
  return undefined;
}

const lebensohlAlternativeGroups: readonly AlternativeGroup[] = [
  {
    label: "Weak relay signoff paths",
    members: [
      "lebensohl-weak-relay-clubs",
      "lebensohl-weak-relay-diamonds",
      "lebensohl-weak-relay-hearts",
      "lebensohl-weak-relay-spades",
    ],
    tier: "alternative",
    // All produce 2NT relay; distinction is the intended signoff suit after 3C.
  },
  {
    label: "Competitive borderline actions",
    members: [
      "lebensohl-penalty-double",
      "lebensohl-weak-signoff",
    ],
    tier: "alternative",
    // Borderline 9-10 HCP hands with 4+ in overcall suit could defensibly double or pass.
  },
];

export const lebensohlLiteConfig: ConventionConfig = {
  id: "lebensohl-lite",
  name: "Lebensohl (Lite)",
  description:
    "Responder actions after partner opens 1NT and opponent overcalls at the 2-level",
  category: ConventionCategory.Competitive,
  dealConstraints: lebensohlLiteDealConstraints,
  protocol: lebensohlLiteProtocol,
  explanations: lebensohlLiteExplanations,
  defaultAuction: lebensohlLiteDefaultAuction,
  baselineRules: baselineTransitionRules,
  transitionRules: lebensohlTransitionRules,
  intentResolvers: lebensohlResolvers,
  acceptableAlternatives: lebensohlAlternativeGroups,
  teaching: {
    purpose: "Distinguish weak hands, relay actions, and penalty doubles after interference over 1NT",
    whenToUse: "Partner opens 1NT and an opponent overcalls 2D, 2H, or 2S",
    whenNotToUse: ["No opponent two-level overcall", "When your side did not open 1NT"],
    tradeoff: "The lite version models relay continuations but not full Lebensohl competitive branches.",
    roles: "Responder chooses direct game-forcing bids versus relay/signoff paths; opener has a forced 3C relay completion.",
  },
};
