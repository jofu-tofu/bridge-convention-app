// Sources consulted:
// - bridgebum.com/dont.php [bridgebum/dont]
// - Marty Bergen, original DONT description [Bergen/dont]

import { Seat } from "../../../engine/types";
import type { DealConstraints, Hand, Auction, Deal } from "../../../engine/types";
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { getSuitLength } from "../../../engine/hand-evaluator";
import { dontProtocol } from "./tree";
import { dontExplanations } from "./explanations";

// ─── Deal Constraints ─────────────────────────────────────────

/** DONT deal constraints: East opens 1NT (15-17 balanced), South overcalls (8-15, shape) */
export const dontDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 15,
      customCheck: (hand: Hand) => {
        const shape = getSuitLength(hand);
        const sorted = [...shape].sort((a, b) => b - a);
        return sorted[0]! >= 6 || (sorted[0]! >= 5 && sorted[1]! >= 4);
      },
    },
  ],
  dealer: Seat.East,
};

// ─── Default Auction ──────────────────────────────────────────

/** Overcaller position: East opened 1NT */
function dontDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  // Advance positions handled by specific auction patterns in the advance rules
  return undefined;
}

// ─── Convention Config ────────────────────────────────────────

export const dontConfig: ConventionConfig = {
  id: "dont",
  name: "DONT",
  description:
    "DONT (Disturbing Opponent's No Trump): overcalls against 1NT openings",
  category: ConventionCategory.Defensive,
  dealConstraints: dontDealConstraints,
  allowedDealers: [Seat.East, Seat.West],
  protocol: dontProtocol,
  explanations: dontExplanations,
  defaultAuction: dontDefaultAuction,
};
