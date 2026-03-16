import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { createBundle } from "../../core/bundle";
import { NT_STAYMAN_ONLY_PROFILE, NT_TRANSFERS_ONLY_PROFILE } from "./system-profile";
import { NT_CROSS_MODULE_RELATIONS } from "./pedagogical-relations";
import { compileProfileFromPackages } from "../../core/composition/compile-from-packages";
import { NT_SKELETON } from "./compose";
import { naturalNtPackage } from "./packages/natural-nt";
import { staymanPackage } from "./packages/stayman";
import { jacobyTransfersPackage } from "./packages/jacoby-transfers";

const staymanComposed = compileProfileFromPackages(
  NT_STAYMAN_ONLY_PROFILE,
  [naturalNtPackage, staymanPackage],
  {
    machineId: NT_SKELETON.machineId,
    skeletonStates: NT_SKELETON.states,
    dispatchStateId: NT_SKELETON.dispatchStateId,
    entrySurfaceGroupId: NT_SKELETON.entrySurfaceGroupId,
    crossModuleRelations: NT_CROSS_MODULE_RELATIONS,
  },
);

const transferComposed = compileProfileFromPackages(
  NT_TRANSFERS_ONLY_PROFILE,
  [naturalNtPackage, jacobyTransfersPackage],
  {
    machineId: NT_SKELETON.machineId,
    skeletonStates: NT_SKELETON.states,
    dispatchStateId: NT_SKELETON.dispatchStateId,
    entrySurfaceGroupId: NT_SKELETON.entrySurfaceGroupId,
    crossModuleRelations: NT_CROSS_MODULE_RELATIONS,
  },
);

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

export const ntStaymanBundle = createBundle({
  id: "nt-stayman",
  name: "Stayman Only",
  description: "Practice Stayman responses to 1NT opening (no Jacoby Transfers)",
  category: ConventionCategory.Asking,
  memberIds: ["stayman"],
  composed: staymanComposed,
  dealConstraints: staymanDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  systemProfile: NT_STAYMAN_ONLY_PROFILE,
});

export const ntTransfersBundle = createBundle({
  id: "nt-transfers",
  name: "Jacoby Transfers Only",
  description: "Practice Jacoby Transfer responses to 1NT opening (no Stayman)",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers"],
  composed: transferComposed,
  dealConstraints: transferDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) return buildAuction(Seat.North, ["1NT", "P"]);
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  systemProfile: NT_TRANSFERS_ONLY_PROFILE,
});
