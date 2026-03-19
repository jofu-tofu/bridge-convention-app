import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../../core/contracts/convention";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { createExplanationCatalog } from "../../../core/contracts/explanation-catalog";
import { NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./system-profile";

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

const ntDefaultAuction = (seat: typeof Seat[keyof typeof Seat]) => {
  if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
  return undefined;
};

const ntDeclaredCapabilities = { [CAP_OPENING_1NT]: "active" } as const;

/**
 * Minimal sub-bundles for legacy registration.
 * Strategy is now handled by the protocol frame architecture.
 */
export const ntStaymanBundle: ConventionBundle = {
  id: "nt-stayman",
  name: "Stayman Only",
  description: "Practice Stayman responses to 1NT opening (no Jacoby Transfers)",
  category: ConventionCategory.Asking,
  memberIds: ["stayman"],
  dealConstraints: staymanDealConstraints,
  defaultAuction: ntDefaultAuction,
  declaredCapabilities: ntDeclaredCapabilities,
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
  explanationCatalog: createExplanationCatalog([]),
  pedagogicalRelations: [],
  acceptableAlternatives: [],
  intentFamilies: [],
};

export const ntTransfersBundle: ConventionBundle = {
  id: "nt-transfers",
  name: "Jacoby Transfers Only",
  description: "Practice Jacoby Transfer responses to 1NT opening (no Stayman)",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers"],
  dealConstraints: transferDealConstraints,
  defaultAuction: ntDefaultAuction,
  declaredCapabilities: ntDeclaredCapabilities,
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
  explanationCatalog: createExplanationCatalog([]),
  pedagogicalRelations: [],
  acceptableAlternatives: [],
  intentFamilies: [],
};
