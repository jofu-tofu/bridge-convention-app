import { Seat } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import type { TreeConventionConfig } from "../../core/rule-tree";
import { saycRuleTree } from "./tree";
import { saycExplanations } from "./explanations";

export const saycConfig: TreeConventionConfig = {
  id: "sayc",
  name: "Standard American Yellow Card",
  description:
    "Standard American Yellow Card — full bidding system covering openings, responses, rebids, and competitive bids",
  category: ConventionCategory.Constructive,
  dealConstraints: {
    seats: [
      // 10 HCP (not 12): ensures South practices both opening and responding positions.
      // 12+ biases heavily toward opening hands.
      { seat: Seat.South, minHcp: 10 },
    ],
  },
  defaultAuction: () => undefined,
  ruleTree: saycRuleTree,
  explanations: saycExplanations,
};
