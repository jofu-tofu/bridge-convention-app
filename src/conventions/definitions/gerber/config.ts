import { Seat } from "../../../engine/types";
import type { DealConstraints, Auction } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { gerberProtocol } from "./tree";
import { gerberExplanations } from "./explanations";

/** Gerber deal constraints: opener 15-17 balanced (standard 1NT), responder 16+ HCP */
export const gerberDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 16,
    },
  ],
  dealer: Seat.North,
};

/** Responder position starts after 1NT - P. */
function gerberDefaultAuction(
  seat: Seat,
  _deal?: import("../../../engine/types").Deal,
): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const gerberConfig: ConventionConfig = {
  id: "gerber",
  name: "Gerber",
  description:
    "Gerber convention: 4C response to NT opening asking for aces, then 5C for kings (slam exploration)",
  category: ConventionCategory.Asking,
  dealConstraints: gerberDealConstraints,
  protocol: gerberProtocol,
  explanations: gerberExplanations,
  defaultAuction: gerberDefaultAuction,
};
