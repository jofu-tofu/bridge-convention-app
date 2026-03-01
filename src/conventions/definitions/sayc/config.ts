import { Seat } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { saycProtocol } from "./tree";
import { saycTransitionRules } from "./transitions";
import { saycResolvers } from "./resolvers";

export const saycConfig: ConventionConfig = {
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
  protocol: saycProtocol,
  transitionRules: saycTransitionRules,
  baselineRules: baselineTransitionRules,
  intentResolvers: saycResolvers,
};
