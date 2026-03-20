import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat } from "../../../engine/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { ConventionCategory } from "../../../core/contracts/convention";
import { buildAuction } from "../../../engine/auction-helpers";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import { ntCrossConventionAlternatives } from "./alternatives";
import { NT_EXPLANATION_CATALOG } from "./explanation-catalog";
import { NT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";
import { NT_SAYC_PROFILE } from "./system-profile";

/** Factory: creates NT deal constraints from system config. */
export function createNtDealConstraints(sys: SystemConfig): DealConstraints {
  return {
    seats: [
      { seat: Seat.North, minHcp: sys.ntOpening.minHcp, maxHcp: sys.ntOpening.maxHcp, balanced: true },
      {
        seat: Seat.South,
        minHcp: 0,
      },
    ],
    dealer: Seat.North,
  };
}

/** Factory: creates off-convention deal constraints from system config. */
export function createNtOffConventionConstraints(sys: SystemConfig): DealConstraints {
  return {
    seats: [
      { seat: Seat.North, minHcp: sys.ntOpening.minHcp, maxHcp: sys.ntOpening.maxHcp, balanced: true },
      {
        seat: Seat.South,
        minHcp: 0,
        maxHcp: sys.responderThresholds.inviteMin - 1,
      },
    ],
    dealer: Seat.North,
  };
}

/**
 * Minimal ConventionBundle for legacy registration.
 * Strategy is now handled by the protocol frame architecture (convention-spec.ts).
 */
export const ntBundle: ConventionBundle = {
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers + Smolen responses to 1NT opening",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers", "stayman", "smolen"],
  systemConfig: SAYC_SYSTEM_CONFIG,
  dealConstraints: createNtDealConstraints(SAYC_SYSTEM_CONFIG),
  offConventionConstraints: createNtOffConventionConstraints(SAYC_SYSTEM_CONFIG),
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  systemProfile: NT_SAYC_PROFILE,
  acceptableAlternatives: ntCrossConventionAlternatives,
  explanationCatalog: NT_EXPLANATION_CATALOG,
  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
  intentFamilies: [],
};
