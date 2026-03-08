import { Seat } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import type { AlternativeGroup } from "../../../core/contracts";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { saycProtocol } from "./tree";
import { saycTransitionRules } from "./transitions";
import { saycResolvers } from "./resolvers";
import { saycOverlays } from "./overlays";

// ─── Acceptable Alternatives ──────────────────────────────────

const saycAlternativeGroups: readonly AlternativeGroup[] = [
  {
    label: "Major suit responses to minor opening",
    members: [
      "sayc-respond-1h-over-minor",
      "sayc-respond-1s-over-minor",
    ],
    tier: "alternative",
    // Both are 4-card major responses; when holding both 4-card majors,
    // either response is acceptable (up-the-line vs longest-first).
  },
  {
    label: "NT raise levels",
    members: [
      "sayc-respond-2nt",
      "sayc-respond-3nt",
    ],
    tier: "alternative",
    // Adjacent HCP ranges (13-15 / 16-18) make boundary hands interchangeable.
  },
];

// ─── Convention Config ────────────────────────────────────────

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
  overlays: saycOverlays,
  acceptableAlternatives: saycAlternativeGroups,
};
