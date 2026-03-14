/**
 * ConventionConfig wrapper for the 1NT Response Bundle.
 *
 * Makes the bundle selectable in the convention picker as "1NT Responses".
 * When selected, the drill infrastructure uses the meaning pipeline (via the bundle).
 */

import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { ntBundle } from "./config";

/** Convention picker entry for the 1NT Response Bundle.
 *  Uses the bundle's deal constraints, default auction, and category.
 *  The config-factory detects this ID in the bundle registry and
 *  dispatches to the meaning pipeline automatically. */
export const ntBundleConventionConfig: ConventionConfig = {
  id: ntBundle.id,
  name: "1NT Responses",
  description:
    "Full 1NT response system: Stayman + Jacoby Transfers + natural bids — practice choosing between conventions",
  category: ntBundle.category ?? ConventionCategory.Asking,
  dealConstraints: ntBundle.dealConstraints,
  defaultAuction: ntBundle.defaultAuction,
};
