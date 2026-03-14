/**
 * ConventionConfig wrapper for the Bergen Raises Bundle.
 *
 * Makes the bundle selectable in the convention picker as "Bergen Raises (Bundle)".
 * When selected, the drill infrastructure uses the meaning pipeline (via the bundle).
 * The tree-based "bergen-raises" convention remains available as a separate drill
 * using the tree pipeline.
 */

import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { bergenBundle } from "./config";

/** Convention picker entry for the Bergen Raises Bundle.
 *  Uses the bundle's deal constraints, default auction, and category.
 *  The config-factory detects this ID in the bundle registry and
 *  dispatches to the meaning pipeline automatically. */
export const bergenBundleConventionConfig: ConventionConfig = {
  id: bergenBundle.id,
  name: "Bergen Raises (Bundle)",
  description:
    "Bergen Raises via the meaning pipeline — constructive, limit, game, preemptive, and splinter raises after 1M opening",
  category: bergenBundle.category ?? ConventionCategory.Constructive,
  dealConstraints: bergenBundle.dealConstraints,
  defaultAuction: bergenBundle.defaultAuction,
  internal: bergenBundle.internal,
};
