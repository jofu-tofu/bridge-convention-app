import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./system-profile";
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
} from "./meaning-surfaces";
import { staymanFacts, transferFacts, ntResponseFacts } from "./facts";
import { NT_ROUTED_SURFACES, createNtSurfaceRouter } from "./surface-routing";
import { createNtConversationMachine } from "./machine";
import { NT_EXPLANATION_CATALOG } from "./explanation-catalog";
import { NT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

// Stayman-only deal constraints: opener balanced 15-17, responder 8+ HCP with 4-card major
const staymanDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    { seat: Seat.South, minHcp: 8, minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 } },
  ],
  dealer: Seat.North,
};

// Transfer-only deal constraints: opener balanced 15-17, responder with 5+ major
const transferDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    { seat: Seat.South, minHcp: 0, minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 } },
  ],
  dealer: Seat.North,
};

const staymanMachine = createNtConversationMachine();
const transferMachine = createNtConversationMachine();

/** Stayman-only sub-bundle: Stayman convention + natural NT responses. */
export const ntStaymanBundle: ConventionBundle = {
  id: "nt-stayman",
  name: "Stayman Only",
  description: "Practice Stayman responses to 1NT opening (no Jacoby Transfers)",
  category: ConventionCategory.Asking,
  memberIds: ["stayman"],
  dealConstraints: staymanDealConstraints,
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
    { groupId: "responder-r3-after-stayman-2h", surfaces: STAYMAN_R3_AFTER_2H_SURFACES },
    { groupId: "responder-r3-after-stayman-2s", surfaces: STAYMAN_R3_AFTER_2S_SURFACES },
    { groupId: "responder-r3-after-stayman-2d", surfaces: STAYMAN_R3_AFTER_2D_SURFACES },
  ],
  factExtensions: [staymanFacts, ntResponseFacts],
  surfaceRouter: createNtSurfaceRouter(NT_ROUTED_SURFACES, staymanMachine),
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  conversationMachine: staymanMachine,
  explanationCatalog: NT_EXPLANATION_CATALOG,
  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
};

/** Transfer-only sub-bundle: Jacoby Transfers + natural NT responses. */
export const ntTransfersBundle: ConventionBundle = {
  id: "nt-transfers",
  name: "Jacoby Transfers Only",
  description: "Practice Jacoby Transfer responses to 1NT opening (no Stayman)",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers"],
  dealConstraints: transferDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { ntOpenerContext: "active" },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: RESPONDER_SURFACES },
    { groupId: "opener-transfer-accept", surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
    { groupId: "opener-transfer-accept-spades", surfaces: OPENER_TRANSFER_SPADES_SURFACES },
    { groupId: "responder-r3-after-transfer-hearts", surfaces: TRANSFER_R3_HEARTS_SURFACES },
    { groupId: "responder-r3-after-transfer-spades", surfaces: TRANSFER_R3_SPADES_SURFACES },
  ],
  factExtensions: [transferFacts, ntResponseFacts],
  surfaceRouter: createNtSurfaceRouter(NT_ROUTED_SURFACES, transferMachine),
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
  conversationMachine: transferMachine,
  explanationCatalog: NT_EXPLANATION_CATALOG,
  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
};
