import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat } from "../../../engine/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { ntCrossConventionAlternatives } from "./alternatives";
import { NT_SAYC_PROFILE } from "./system-profile";

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

/**
 * Minimal ConventionBundle for legacy registration.
 * Strategy is now handled by the protocol frame architecture (convention-spec.ts).
 */
export const ntBundle: ConventionBundle = {
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers responses to 1NT opening",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers", "stayman", "smolen"],
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
};
