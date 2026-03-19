import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../../core/contracts/convention";
import { CAP_OPPONENT_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { DONT_PROFILE } from "./system-profile";
import { DONT_ALTERNATIVE_GROUPS } from "./alternatives";
import { DONT_EXPLANATION_CATALOG } from "./explanation-catalog";
import { DONT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

const dontBundleDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
    },
    {
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 15,
      minLengthAny: {
        [Suit.Clubs]: 5,
        [Suit.Diamonds]: 5,
        [Suit.Hearts]: 5,
        [Suit.Spades]: 5,
      },
    },
  ],
  dealer: Seat.East,
};

/**
 * Minimal ConventionBundle for legacy registration.
 * Strategy is now handled by the protocol frame architecture (convention-spec.ts).
 */
export const dontBundle: ConventionBundle = {
  id: "dont-bundle",
  name: "DONT Bundle",
  description:
    "DONT (Disturbing Opponents' Notrump) — competitive overcalls after opponent's 1NT",
  category: ConventionCategory.Defensive,
  memberIds: ["dont-bundle", "dont"],
  declaredCapabilities: { [CAP_OPPONENT_1NT]: "active" },
  dealConstraints: dontBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.West) {
      return buildAuction(Seat.East, ["1NT"]);
    }
    return undefined;
  },
  systemProfile: DONT_PROFILE,
  acceptableAlternatives: DONT_ALTERNATIVE_GROUPS,
  explanationCatalog: DONT_EXPLANATION_CATALOG,
  pedagogicalRelations: DONT_PEDAGOGICAL_RELATIONS,
  intentFamilies: [],
};
