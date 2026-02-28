import { Seat, Suit } from "../../../engine/types";
import type { DealConstraints, Auction, Deal } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { getSuitLength } from "../../../engine/hand-evaluator";
import { bergenProtocol } from "./tree";
import { bergenExplanations } from "./explanations";

// ─── Deal Constraints ─────────────────────────────────────────

/** Bergen Raises deal constraints: opener 12-21 HCP with 5+ major, responder 0+ HCP with exactly 4 in a major */
export const bergenDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 12,
      maxHcp: 21,
      minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 },
    },
    {
      seat: Seat.South,
      minHcp: 0,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
      maxLength: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

// ─── Default Auction ──────────────────────────────────────────

function bergenDefaultAuction(seat: Seat, deal?: Deal): Auction | undefined {
  if (seat !== Seat.South) return undefined;
  if (!deal) return buildAuction(Seat.North, ["1H", "P"]);
  const openerShape = getSuitLength(deal.hands[Seat.North]);
  const spades = openerShape[0]; // index 0 = Spades
  const hearts = openerShape[1]; // index 1 = Hearts
  // SAYC: open the LONGER major; with 5-5, prefer 1S (higher-ranking)
  const openMajor = spades >= 5 && spades >= hearts ? "1S" : "1H";
  return buildAuction(Seat.North, [openMajor, "P"]);
}

// ─── Convention Config ────────────────────────────────────────

export const bergenConfig: ConventionConfig = {
  id: "bergen-raises",
  name: "Bergen Raises",
  description:
    "Bergen Raises: coded responses to 1M opening showing support and strength",
  category: ConventionCategory.Constructive,
  dealConstraints: bergenDealConstraints,
  protocol: bergenProtocol,
  explanations: bergenExplanations,
  defaultAuction: bergenDefaultAuction,
};
