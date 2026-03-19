import { createConventionConfigFromBundle } from "../../core/bundle";
import type { ConventionConfig } from "../../../core/contracts/convention";
import { ConventionCategory } from "../../../core/contracts/convention";
import { Seat } from "../../../engine/types";
import { weakTwoBundle } from "./config";

export const weakTwoBundleConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(weakTwoBundle, {
    name: "Weak Two Bids (Bundle)",
    description:
      "Weak Two Bids with Ogust 2NT — preemptive openings at the 2-level with structured hand description",
    categoryFallback: ConventionCategory.Constructive,
  }),
  allowedDealers: [Seat.North],
  teaching: {
    purpose:
      "Open light hands with a long suit at the 2-level to preempt opponents, and use the Ogust convention to describe hand strength and suit quality",
    whenToUse:
      "Open 2D/2H/2S with 6+ cards in the suit and 5-11 HCP. As responder, use 2NT (Ogust) to ask about opener's hand, raise to game with 16+ HCP and fit, or invite with 14-15 HCP and fit.",
    whenNotToUse: [
      "2C is reserved for strong openings — never open 2C as a weak two",
      "With a hand too strong for a weak two (12+ HCP) — open at the 1-level instead",
      "After opponent interference — standard competitive actions apply",
    ],
    tradeoff:
      "2-level openings lose their natural strong meaning in favor of preemptive action",
    principle:
      "Weak twos simultaneously obstruct opponents and describe a narrow hand type (6-card suit, limited strength) that partner can evaluate precisely",
    roles:
      "Opener describes; responder captains. After Ogust 2NT, opener further classifies along strength and quality dimensions",
  },
};
