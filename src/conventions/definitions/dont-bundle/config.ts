import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPPONENT_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
  DONT_REVEAL_SURFACES,
  DONT_2C_RELAY_SURFACES,
  DONT_2D_RELAY_SURFACES,
} from "./meaning-surfaces";
import { dontFacts } from "./facts";
import { DONT_PROFILE } from "./system-profile";
import { DONT_ROUTED_SURFACES, createDontSurfaceRouter } from "./surface-routing";
import { createDontConversationMachine } from "./machine";
import { DONT_EXPLANATION_CATALOG } from "./explanation-catalog";
import { DONT_ALTERNATIVE_GROUPS } from "./alternatives";
import { DONT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

const dontBundleDealConstraints: DealConstraints = {
  seats: [
    // East = opener: 15-17 HCP, balanced (1NT opener)
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
    },
    // South = overcaller: 8+ HCP, at least one 5+ card suit for DONT
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

export const dontBundle = createBundle({
  id: "dont-bundle",
  name: "DONT Bundle",
  description:
    "DONT (Disturbing Opponent's No Trump) — competitive overcalls after opponent's 1NT",
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
  meaningSurfaces: [
    // R1: Overcaller DONT action
    { groupId: "overcaller-r1", surfaces: DONT_R1_SURFACES },
    // Advancer responses per overcaller action
    { groupId: "advancer-after-2h", surfaces: DONT_ADVANCER_2H_SURFACES },
    { groupId: "advancer-after-2d", surfaces: DONT_ADVANCER_2D_SURFACES },
    { groupId: "advancer-after-2c", surfaces: DONT_ADVANCER_2C_SURFACES },
    { groupId: "advancer-after-2s", surfaces: DONT_ADVANCER_2S_SURFACES },
    {
      groupId: "advancer-after-double",
      surfaces: DONT_ADVANCER_DOUBLE_SURFACES,
    },
    // Overcaller reveal / relay responses
    { groupId: "overcaller-reveal", surfaces: DONT_REVEAL_SURFACES },
    { groupId: "overcaller-2c-relay", surfaces: DONT_2C_RELAY_SURFACES },
    { groupId: "overcaller-2d-relay", surfaces: DONT_2D_RELAY_SURFACES },
  ],
  factExtensions: [dontFacts],
  surfaceRouter: createDontSurfaceRouter(DONT_ROUTED_SURFACES),
  systemProfile: DONT_PROFILE,
  conversationMachine: createDontConversationMachine(),
  explanationCatalog: DONT_EXPLANATION_CATALOG,
  pedagogicalRelations: DONT_PEDAGOGICAL_RELATIONS,
  acceptableAlternatives: DONT_ALTERNATIVE_GROUPS,
});
