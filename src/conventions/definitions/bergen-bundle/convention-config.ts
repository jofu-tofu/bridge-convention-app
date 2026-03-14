import { createConventionConfigFromBundle } from "../../core/bundle";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { bergenBundle } from "./config";

export const bergenBundleConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(bergenBundle, {
    name: "Bergen Raises (Bundle)",
    description:
      "Bergen Raises via the meaning pipeline — constructive, limit, game, preemptive, and splinter raises after 1M opening",
    categoryFallback: ConventionCategory.Constructive,
  }),
  teaching: {
    purpose:
      "Show the right level of support when partner opens 1 of a major and you have 4+ card fit",
    whenToUse:
      "Partner opens 1H or 1S and you have 4+ cards in their major. Choose the raise level based on HCP: preemptive (0-6), constructive (7-10), limit (10-12), game (13+), or splinter (12+ with shortage).",
    whenNotToUse: [
      "Fewer than 4 cards in partner's major — look for other bids",
      "Passed hand — Bergen raises are off after a passed hand",
      "After opponent interference — standard raises apply instead",
    ],
    tradeoff:
      "3C and 3D lose their natural minor-suit meanings in favor of showing major support",
    principle:
      "With a known trump fit, bid to the level your combined strength supports — preempt with weakness, invite with middle values, bid game with strength",
    roles:
      "Opener evaluates whether the partnership has game after responder's Bergen bid",
  },
};
