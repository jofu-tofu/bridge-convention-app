import { createConventionConfigFromBundle } from "../../core/bundle";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { ntBundle } from "./config";
import { ntStaymanBundle, ntTransfersBundle } from "./sub-bundles";

export const ntBundleConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(ntBundle, {
    name: "1NT Responses",
    description:
      "Full 1NT response system: Stayman + Jacoby Transfers + natural bids — practice choosing between conventions",
    categoryFallback: ConventionCategory.Asking,
  }),
  teaching: {
    purpose:
      "Find the best contract after partner opens 1NT: major-suit fit via Stayman or transfers, or notrump game/invite",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You choose between Stayman (4-card major, 8+ HCP), Jacoby Transfer (5+ card major), or natural NT bids (no major).",
    whenNotToUse: [
      "0-7 HCP with no 5-card major — pass",
      "5+ card major — use transfer, not Stayman, even with 4 in the other major",
      "4333 shape with 8-9 HCP — 2NT invite may be better than Stayman",
    ],
    tradeoff:
      "Artificial bids (2C Stayman, 2D/2H transfers) give up natural meanings of those bids",
    principle:
      "Finding an 8-card major fit is worth more than notrump; Stayman and transfers are tools to find that fit",
    roles:
      "Responder is captain after 1NT — opener describes, responder decides the final contract",
  },
};

export const ntStaymanConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(ntStaymanBundle, {
    name: "Stayman",
    description: "Stayman convention — find a 4-4 major fit after 1NT opening",
    categoryFallback: ConventionCategory.Asking,
  }),
  teaching: {
    purpose:
      "Find a 4-4 major-suit fit after partner opens 1NT using the 2C Stayman bid",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You have 8+ HCP and a 4-card major (no 5-card major).",
    whenNotToUse: [
      "5+ card major — use Jacoby Transfer instead",
      "Under 8 HCP — pass",
      "No 4-card major — bid 2NT (invite) or 3NT (game) directly",
    ],
    principle:
      "2C asks opener to show a 4-card major; responder then places the contract based on fit",
    roles:
      "Responder is captain — asks opener to describe, then decides the final contract",
  },
};

export const ntTransfersConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(ntTransfersBundle, {
    name: "Jacoby Transfers",
    description: "Jacoby Transfers — ensure the strong hand declares in a major-suit contract",
    categoryFallback: ConventionCategory.Constructive,
  }),
  teaching: {
    purpose:
      "Transfer the contract to opener's hand when responder has a 5+ card major after 1NT opening",
    whenToUse:
      "Partner opens 1NT (15-17 HCP balanced). You have a 5+ card major suit.",
    whenNotToUse: [
      "Only a 4-card major — use Stayman instead",
      "No major suits — bid notrump directly",
    ],
    principle:
      "2D transfers to hearts, 2H transfers to spades — opener always accepts, making the strong hand declarer",
    roles:
      "Responder initiates the transfer; opener mechanically accepts; responder then decides the final contract level",
  },
};
