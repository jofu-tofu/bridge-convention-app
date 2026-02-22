import type { CommandDef } from "../types";
import { ok, err } from "../types";
import { Seat, type Auction } from "../../engine/types";
import { parseHand } from "../../engine/notation";
import { getConvention } from "../../conventions/registry";
import { buildAuction } from "../../engine/auction-helpers";
import { conventionToStrategy } from "../../ai/convention-strategy";
import { suggestBid } from "../../engine/bid-suggester";

const SEAT_MAP: Record<string, Seat> = {
  N: Seat.North,
  E: Seat.East,
  S: Seat.South,
  W: Seat.West,
};

export const bidCommand: CommandDef = {
  name: "bid",
  description: "Suggest a bid using a convention",
  phase: 2,
  options: {
    hand: {
      type: "string",
      short: "h",
      description: "Hand cards (space-separated, e.g. 'SA SK SQ ...')",
    },
    seat: { type: "string", short: "s", description: "Bidding seat (N|E|S|W)" },
    convention: {
      type: "string",
      short: "c",
      description: "Convention to use",
    },
    auction: {
      type: "string",
      short: "a",
      description: "Auction context (e.g. '1NT P')",
    },
    dealer: {
      type: "string",
      short: "d",
      description: "Dealer seat for auction (N|E|S|W, default: N)",
    },
  },
  async handler(args, _deps) {
    if (!args.convention) {
      return err({ code: "INVALID_ARGS", message: "Missing --convention" });
    }
    if (!args.hand) {
      return err({ code: "INVALID_ARGS", message: "Missing --hand" });
    }
    const seat = args.seat
      ? SEAT_MAP[String(args.seat).toUpperCase()]
      : undefined;
    if (!seat) {
      return err({
        code: "INVALID_ARGS",
        message: "Missing or invalid --seat (N|E|S|W)",
      });
    }

    const conventionId = String(args.convention);
    const handCards = String(args.hand).split(/\s+/);
    const hand = parseHand(handCards);

    const convention = getConvention(conventionId);
    const strategy = conventionToStrategy(convention);

    let auction: Auction;
    if (args.auction) {
      const bids = String(args.auction).split(/\s+/);
      const dealer = args.dealer
        ? (SEAT_MAP[String(args.dealer).toUpperCase()] ?? Seat.North)
        : Seat.North;
      auction = buildAuction(dealer, bids);
    } else {
      auction = convention.defaultAuction?.(seat, undefined) ?? {
        entries: [],
        isComplete: false,
      };
    }

    const result = suggestBid(hand, auction, seat, strategy);

    return ok({
      type: "bid",
      data: {
        call: result.call,
        rule: result.ruleName,
        explanation: result.explanation,
      },
    });
  },
};
