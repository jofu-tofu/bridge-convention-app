import type { CommandDef } from "../types";
import { Seat } from "../../engine/types";
import type { Auction } from "../../engine/types";
import { parseHand } from "../../engine/notation";
import { getConvention } from "../../conventions/registry";
import { buildAuction } from "../../engine/auction-helpers";
import { conventionToStrategy } from "../../ai/convention-strategy";
import type { CliError } from "../errors";

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
    hand: { type: "string", short: "h", description: "Hand cards (space-separated, e.g. 'SA SK SQ ...')" },
    seat: { type: "string", short: "s", description: "Bidding seat (N|E|S|W)" },
    convention: { type: "string", short: "c", description: "Convention to use" },
    auction: { type: "string", short: "a", description: "Auction context (e.g. '1NT P')" },
  },
  async handler(args, deps) {
    if (!args.convention) {
      const err: CliError = { code: "INVALID_ARGS", message: "Missing --convention" };
      throw err;
    }
    if (!args.hand) {
      const err: CliError = { code: "INVALID_ARGS", message: "Missing --hand" };
      throw err;
    }
    if (!args.seat || !SEAT_MAP[String(args.seat).toUpperCase()]) {
      const err: CliError = { code: "INVALID_ARGS", message: "Missing or invalid --seat (N|E|S|W)" };
      throw err;
    }

    const conventionId = String(args.convention);
    const seat = SEAT_MAP[String(args.seat).toUpperCase()]!;
    const handCards = String(args.hand).split(/\s+/);
    const hand = parseHand(handCards);

    const convention = getConvention(conventionId);
    const strategy = conventionToStrategy(convention);

    let auction: Auction;
    if (args.auction) {
      const bids = String(args.auction).split(/\s+/);
      auction = buildAuction(Seat.North, bids);
    } else {
      auction = convention.defaultAuction?.(seat) ?? { entries: [], isComplete: false };
    }

    const result = await deps.engine.suggestBid(hand, auction, seat, strategy);

    return {
      type: "bid",
      data: {
        call: result.call,
        rule: result.ruleName,
        explanation: result.explanation,
      },
    };
  },
};
