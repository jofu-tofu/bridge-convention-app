import { Seat } from "../../engine/types";
import type { Deal, Hand } from "../../engine/types";
import { parseHand } from "../../engine/notation";
import type { CommandDef, CommandResult } from "../types";

function parseSeat(s: string): Seat | undefined {
  const map: Record<string, Seat> = {
    N: Seat.North,
    E: Seat.East,
    S: Seat.South,
    W: Seat.West,
  };
  return map[s.toUpperCase()];
}

export const evaluateCommand: CommandDef = {
  name: "evaluate",
  description: "Evaluate a hand (HCP, shape, distribution points)",
  phase: 1,
  options: {
    hand: { type: "string", short: "h", description: "Space-separated card notations (e.g. SA SK HK ...)" },
    "hand-from": { type: "string", description: "Read hand from source (stdin)" },
    seat: { type: "string", short: "s", description: "Seat to evaluate from piped deal (N|E|S|W)" },
    strategy: { type: "string", description: "Evaluation strategy (default: HCP)" },
  },
  async handler(args, deps) {
    let hand: Hand;

    if (args["hand-from"] === "stdin") {
      if (!args.seat) {
        throw {
          code: "INVALID_ARGS" as const,
          message: "--seat is required when reading from stdin.",
        };
      }
      const seat = parseSeat(args.seat as string);
      if (!seat) {
        throw {
          code: "INVALID_ARGS" as const,
          message: `Invalid seat: ${args.seat as string}. Use N, E, S, or W.`,
        };
      }
      const stdinResult = await deps.readStdin();
      const deal = stdinResult.data as Deal;
      if (!deal.hands || !deal.hands[seat]) {
        throw {
          code: "PARSE_ERROR" as const,
          message: `No hand found for seat ${seat} in piped data.`,
        };
      }
      hand = deal.hands[seat];
    } else if (args.hand) {
      const notations = (args.hand as string).split(/\s+/);
      hand = parseHand(notations);
    } else {
      throw {
        code: "INVALID_ARGS" as const,
        message: "Provide --hand or --hand-from stdin.",
      };
    }

    const strategy = args.strategy as string | undefined;
    const evaluation = await deps.engine.evaluateHand(hand, strategy);

    const result: CommandResult = {
      type: "evaluation",
      data: evaluation,
    };

    return result;
  },
};
