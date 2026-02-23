// Sources consulted:
// - bridgebum.com/landy.php [bridgebum/landy]

import { Seat, BidSuit } from "../engine/types";
import type {
  DealConstraints,
  Call,
  Auction,
  Hand,
  Deal,
} from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingContext } from "./types";
import { getSuitLength } from "../engine/hand-evaluator";
import { buildAuction } from "../engine/auction-helpers";
import {
  conditionedRule,
  auctionMatches,
  bothMajors,
  suitMin,
  suitBelow,
} from "./conditions";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Landy deal constraints: East opens 1NT (15-17 balanced), South overcalls (10+, 5-4+ majors) */
export const landyDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 10,
      customCheck: (hand: Hand) => {
        const shape = getSuitLength(hand);
        const spades = shape[0]!;
        const hearts = shape[1]!;
        return (spades >= 5 && hearts >= 4) || (hearts >= 5 && spades >= 4);
      },
    },
  ],
  dealer: Seat.East,
};

// ─── Overcaller Bidding Rules (South, after East opens 1NT) ──

// Rule 1: landy-2c — 2C showing both majors (5-4+)
const landy2C = conditionedRule({
  name: "landy-2c",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [bothMajors()],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
});

// ─── Response Rules (North, after South overcalls 2C) ────────

// Rule 2: landy-response-pass — 5+ clubs, happy to play 2C
const landyResponsePass = conditionedRule({
  name: "landy-response-pass",
  auctionConditions: [auctionMatches(["1NT", "2C", "P"])],
  handConditions: [suitMin(3, "clubs", 5)],
  call(): Call {
    return { type: "pass" };
  },
});

// Rule 3: landy-response-2h — 4+ hearts (natural signoff)
const landyResponse2H = conditionedRule({
  name: "landy-response-2h",
  auctionConditions: [auctionMatches(["1NT", "2C", "P"])],
  handConditions: [suitMin(1, "hearts", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Hearts };
  },
});

// Rule 4: landy-response-2s — 4+ spades, <4 hearts (natural signoff)
const landyResponse2S = conditionedRule({
  name: "landy-response-2s",
  auctionConditions: [auctionMatches(["1NT", "2C", "P"])],
  handConditions: [suitMin(0, "spades", 4), suitBelow(1, "hearts", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Spades };
  },
});

// Rule 5: landy-response-2d — artificial relay (no strong preference)
const landyResponse2D = conditionedRule({
  name: "landy-response-2d",
  auctionConditions: [auctionMatches(["1NT", "2C", "P"])],
  handConditions: [suitBelow(1, "hearts", 4), suitBelow(0, "spades", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Diamonds };
  },
});

/** Overcaller position: East opened 1NT */
function landyDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  return undefined;
}

export const landyConfig: ConventionConfig = {
  id: "landy",
  name: "Landy",
  description:
    "Landy: 2C overcall over opponent's 1NT showing both major suits (5-4+)",
  category: ConventionCategory.Defensive,
  dealConstraints: landyDealConstraints,
  biddingRules: [
    landy2C,
    landyResponsePass,
    landyResponse2H,
    landyResponse2S,
    landyResponse2D,
  ],
  examples: [],
  defaultAuction: landyDefaultAuction,
};
