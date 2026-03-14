import type { ConventionBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { ntCrossConventionAlternatives } from "./alternatives";
import { NT_ROUTED_SURFACES, createNtSurfaceRouter } from "./surface-routing";
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
} from "./meaning-surfaces";
import { staymanFacts, transferFacts, ntResponseFacts } from "./facts";
import { NT_SAYC_PROFILE } from "./system-profile";
import { createNtConversationMachine } from "./machine";
import { NT_EXPLANATION_CATALOG } from "./explanation-catalog";
import { NT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

const ntDealConstraints: DealConstraints = {
  seats: [
    // North = opener: 15-17 HCP, balanced
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    // South = responder: 4+ in any major, 6+ HCP
    {
      seat: Seat.South,
      minHcp: 6,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

const ntMachine = createNtConversationMachine();

export const ntBundle: ConventionBundle = {
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers responses to 1NT opening",
  category: ConventionCategory.Constructive,
  // IMPORTANT: Jacoby first -- transfer priority over Stayman ask.
  // Convention index 0 gets lower orderKeys, wins tie-breaking within tiers.
  memberIds: ["jacoby-transfers", "stayman"],
  dealConstraints: ntDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { ntOpenerContext: "active" },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: RESPONDER_SURFACES },
    { groupId: "opener-stayman-response", surfaces: OPENER_STAYMAN_SURFACES },
    { groupId: "opener-transfer-accept", surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
    { groupId: "opener-transfer-accept-spades", surfaces: OPENER_TRANSFER_SPADES_SURFACES },
    { groupId: "responder-r3-after-stayman-2h", surfaces: STAYMAN_R3_AFTER_2H_SURFACES },
    { groupId: "responder-r3-after-stayman-2s", surfaces: STAYMAN_R3_AFTER_2S_SURFACES },
    { groupId: "responder-r3-after-stayman-2d", surfaces: STAYMAN_R3_AFTER_2D_SURFACES },
    { groupId: "responder-r3-after-transfer-hearts", surfaces: TRANSFER_R3_HEARTS_SURFACES },
    { groupId: "responder-r3-after-transfer-spades", surfaces: TRANSFER_R3_SPADES_SURFACES },
  ],
  factExtensions: [staymanFacts, transferFacts, ntResponseFacts],
  surfaceRouter: createNtSurfaceRouter(NT_ROUTED_SURFACES, ntMachine),
  systemProfile: NT_SAYC_PROFILE,
  conversationMachine: ntMachine,
  explanationCatalog: NT_EXPLANATION_CATALOG,
  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
  acceptableAlternatives: ntCrossConventionAlternatives,
};
