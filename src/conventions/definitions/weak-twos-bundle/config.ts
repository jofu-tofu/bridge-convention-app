import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_WEAK_TWO } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
  WEAK_TWO_OGUST_SPADES_SURFACES,
  WEAK_TWO_OGUST_DIAMONDS_SURFACES,
} from "./meaning-surfaces";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_PROFILE } from "./system-profile";
import { WEAK_TWO_ROUTED_SURFACES, createWeakTwoSurfaceRouter } from "./surface-routing";
import { createWeakTwoConversationMachine } from "./machine";
import { WEAK_TWO_EXPLANATION_CATALOG } from "./explanation-catalog";
import { WEAK_TWO_ALTERNATIVE_GROUPS } from "./alternatives";
import { WEAK_TWO_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

const weakTwoBundleDealConstraints: DealConstraints = {
  seats: [
    // North = opener: 5-11 HCP, 6+ in any of D/H/S
    {
      seat: Seat.North,
      minHcp: 5,
      maxHcp: 11,
      minLengthAny: {
        [Suit.Diamonds]: 6,
        [Suit.Hearts]: 6,
        [Suit.Spades]: 6,
      },
    },
    // South = responder: 14+ HCP
    {
      seat: Seat.South,
      minHcp: 14,
    },
  ],
  dealer: Seat.North,
};

export const weakTwoBundle: ConventionBundle = {
  id: "weak-two-bundle",
  name: "Weak Two Bids Bundle",
  description: "Weak Two Bids with Ogust 2NT response system",
  category: ConventionCategory.Constructive,
  memberIds: ["weak-two-bundle", "weak-twos"],
  declaredCapabilities: { [CAP_OPENING_WEAK_TWO]: "active" },
  dealConstraints: weakTwoBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["2H", "P"]);
    }
    return undefined;
  },
  meaningSurfaces: [
    // R1: Opener weak two bid
    { groupId: "opener-r1", surfaces: WEAK_TWO_R1_SURFACES },
    // R2: Responder actions
    { groupId: "responder-r2-hearts", surfaces: WEAK_TWO_R2_HEARTS_SURFACES },
    { groupId: "responder-r2-spades", surfaces: WEAK_TWO_R2_SPADES_SURFACES },
    { groupId: "responder-r2-diamonds", surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES },
    // R3: Ogust responses
    { groupId: "ogust-response-hearts", surfaces: WEAK_TWO_OGUST_HEARTS_SURFACES },
    { groupId: "ogust-response-spades", surfaces: WEAK_TWO_OGUST_SPADES_SURFACES },
    { groupId: "ogust-response-diamonds", surfaces: WEAK_TWO_OGUST_DIAMONDS_SURFACES },
  ],
  factExtensions: [weakTwoFacts],
  surfaceRouter: createWeakTwoSurfaceRouter(WEAK_TWO_ROUTED_SURFACES),
  systemProfile: WEAK_TWO_PROFILE,
  conversationMachine: createWeakTwoConversationMachine(),
  explanationCatalog: WEAK_TWO_EXPLANATION_CATALOG,
  pedagogicalRelations: WEAK_TWO_PEDAGOGICAL_RELATIONS,
  acceptableAlternatives: WEAK_TWO_ALTERNATIVE_GROUPS,
};
