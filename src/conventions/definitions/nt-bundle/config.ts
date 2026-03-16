import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat } from "../../../engine/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { ntCrossConventionAlternatives } from "./alternatives";
import { NT_SAYC_PROFILE } from "./system-profile";
import { NT_CROSS_MODULE_RELATIONS } from "./pedagogical-relations";
import { compileProfileFromPackages } from "../../core/composition/compile-from-packages";
import { NT_SKELETON } from "./compose";
import { naturalNtPackage } from "./packages/natural-nt";
import { jacobyTransfersPackage } from "./packages/jacoby-transfers";
import { staymanPackage } from "./packages/stayman";
import { smolenPackage } from "./packages/smolen";

const composed = compileProfileFromPackages(
  NT_SAYC_PROFILE,
  [naturalNtPackage, jacobyTransfersPackage, staymanPackage, smolenPackage],
  {
    machineId: NT_SKELETON.machineId,
    skeletonStates: NT_SKELETON.states,
    dispatchStateId: NT_SKELETON.dispatchStateId,
    entrySurfaceGroupId: NT_SKELETON.entrySurfaceGroupId,
    crossModuleRelations: NT_CROSS_MODULE_RELATIONS,
  },
);

const ntDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    {
      seat: Seat.South,
      minHcp: 0,
    },
  ],
  dealer: Seat.North,
};

export const ntBundle = createBundle({
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers responses to 1NT opening",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers", "stayman", "smolen"],
  composed,
  dealConstraints: ntDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  systemProfile: NT_SAYC_PROFILE,
  acceptableAlternatives: ntCrossConventionAlternatives,
});
