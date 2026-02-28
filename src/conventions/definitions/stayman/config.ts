import { Seat, Suit } from "../../../engine/types";
import type { DealConstraints, Auction } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { staymanProtocol } from "./tree";
import { staymanExplanations } from "./explanations";

/** Stayman deal constraints: opener 15-17 balanced no 5M, responder 8+ with 4+M */
export const staymanDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
      maxLength: {
        [Suit.Spades]: 4,
        [Suit.Hearts]: 4,
      },
    },
    {
      seat: Seat.South,
      minHcp: 8,
      minLengthAny: {
        [Suit.Spades]: 4,
        [Suit.Hearts]: 4,
      },
    },
  ],
  dealer: Seat.North,
};

/** Responder position starts after 1NT - P. */
function staymanDefaultAuction(
  seat: Seat,
  _deal?: import("../../../engine/types").Deal,
): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const staymanConfig: ConventionConfig = {
  id: "stayman",
  name: "Stayman",
  description:
    "Stayman convention: 2C response to 1NT asking for 4-card majors",
  category: ConventionCategory.Asking,
  dealConstraints: staymanDealConstraints,
  protocol: staymanProtocol,
  explanations: staymanExplanations,
  defaultAuction: staymanDefaultAuction,
};
