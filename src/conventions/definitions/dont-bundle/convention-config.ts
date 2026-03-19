import { createConventionConfigFromBundle } from "../../core/bundle";
import type { ConventionConfig } from "../../../core/contracts/convention";
import { ConventionCategory } from "../../../core/contracts/convention";
import { Seat } from "../../../engine/types";
import { dontBundle } from "./config";

export const dontBundleConventionConfig: ConventionConfig = {
  ...createConventionConfigFromBundle(dontBundle, {
    name: "DONT (Bundle)",
    description:
      "DONT — Disturbing Opponents' Notrump: competitive overcalls showing distributional hands",
    categoryFallback: ConventionCategory.Defensive,
  }),
  allowedDealers: [Seat.East],
  teaching: {
    purpose:
      "Compete against opponent's 1NT opening with distributional hands, showing two-suited or single-suited holdings via conventional bids and doubles",
    whenToUse:
      "After opponent opens 1NT in direct seat: bid 2H with both majors (5-4+), 2D with diamonds + a major, 2C with clubs + a higher suit, 2S with 6+ natural spades, or double with any single long suit (6+, not spades).",
    whenNotToUse: [
      "In balancing seat (only direct seat overcall implemented)",
      "With a balanced hand lacking distributional shape",
      "With 4-4 or 5-3 shape (minimum 5-4 for two-suited, 6+ for single-suited)",
    ],
    tradeoff:
      "DONT sacrifices natural penalty doubles of 1NT in exchange for showing distributional hands at the 2-level",
    principle:
      "DONT uses conventional overcalls to describe shape (not strength), enabling partner to judge fit and level quickly. The double shows an unknown single suit via a relay mechanism.",
    roles:
      "Overcaller describes shape; advancer evaluates fit. After double, advancer must relay 2C to discover the suit.",
  },
};
