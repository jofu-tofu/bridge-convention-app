import { Seat } from "../../../engine/types";
import type { DealConstraints, Auction, Hand, Deal } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { getSuitLength } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import type { TreeConventionConfig } from "../../core/rule-tree";
import { landyRuleTree } from "./tree";
import { landyExplanations } from "./explanations";

/** Landy deal constraints: East opens 1NT (15-17 balanced), South overcalls (10+, 5-4+ majors) */
export const landyDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 10,
      customCheck: (hand: Hand) => {
        const shape = getSuitLength(hand);
        const spades = shape[0]!;
        const hearts = shape[1]!;
        return (spades >= 5 && hearts >= 4) || (hearts >= 5 && spades >= 4);
      },
    },
  ],
  dealer: Seat.East,
};

/** Overcaller position: East opened 1NT */
function landyDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  return undefined;
}

export const landyConfig: TreeConventionConfig = {
  id: "landy",
  name: "Landy",
  description:
    "Landy: 2C overcall over opponent's 1NT showing both major suits (5-4+)",
  category: ConventionCategory.Defensive,
  dealConstraints: landyDealConstraints,
  allowedDealers: [Seat.East, Seat.West],
  ruleTree: landyRuleTree,
  explanations: landyExplanations,
  defaultAuction: landyDefaultAuction,
};
