import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./system-profile";
import { NT_CROSS_MODULE_RELATIONS } from "./pedagogical-relations";
import { composeNtModules } from "./compose";
import { staymanModule } from "./modules/stayman";
import { jacobyTransfersModule } from "./modules/jacoby-transfers";
import { naturalNtModule } from "./modules/natural-nt";

const staymanComposed = composeNtModules([naturalNtModule, staymanModule], NT_CROSS_MODULE_RELATIONS);
const transferComposed = composeNtModules([naturalNtModule, jacobyTransfersModule], NT_CROSS_MODULE_RELATIONS);

const staymanDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    { seat: Seat.South, minHcp: 8, minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 } },
  ],
  dealer: Seat.North,
};

const transferDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    { seat: Seat.South, minHcp: 0, minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 } },
  ],
  dealer: Seat.North,
};

export const ntStaymanBundle: ConventionBundle = {
  id: "nt-stayman",
  name: "Stayman Only",
  description: "Practice Stayman responses to 1NT opening (no Jacoby Transfers)",
  category: ConventionCategory.Asking,
  memberIds: ["stayman"],
  dealConstraints: staymanDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: staymanComposed.r1Surfaces },
    ...staymanComposed.surfaceGroups,
  ],
  factExtensions: staymanComposed.factExtensions,
  surfaceRouter: staymanComposed.surfaceRouter,
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  conversationMachine: staymanComposed.conversationMachine,
  explanationCatalog: staymanComposed.explanationCatalog,
  pedagogicalRelations: staymanComposed.pedagogicalRelations,
};

export const ntTransfersBundle: ConventionBundle = {
  id: "nt-transfers",
  name: "Jacoby Transfers Only",
  description: "Practice Jacoby Transfer responses to 1NT opening (no Stayman)",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers"],
  dealConstraints: transferDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: transferComposed.r1Surfaces },
    ...transferComposed.surfaceGroups,
  ],
  factExtensions: transferComposed.factExtensions,
  surfaceRouter: transferComposed.surfaceRouter,
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
  conversationMachine: transferComposed.conversationMachine,
  explanationCatalog: transferComposed.explanationCatalog,
  pedagogicalRelations: transferComposed.pedagogicalRelations,
};
