import { Seat } from "../../engine/types";
import type { Deal, Hand } from "../../engine/types";
import { parseHand } from "../../engine/notation";
import type { CommandDef } from "../types";
import { ok, err } from "../types";

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
        return err({
          code: "INVALID_ARGS",
          message: "--seat is required when reading from stdin.",
        });
      }
      const seat = parseSeat(args.seat as string);
      if (!seat) {
        return err({
          code: "INVALID_ARGS",
          message: `Invalid seat: ${args.seat as string}. Use N, E, S, or W.`,
        });
      }
      const stdinResult = await deps.readStdin();
      if (!stdinResult.success) {
        return stdinResult;
      }
      const deal = stdinResult.value.data as Deal;
      if (!deal.hands || !deal.hands[seat]) {
        return err({
          code: "PARSE_ERROR",
          message: `No hand found for seat ${seat} in piped data.`,
        });
      }
      hand = deal.hands[seat];
    } else if (args.hand) {
      const notations = (args.hand as string).split(/\s+/);
      hand = parseHand(notations);
    } else {
      return err({
        code: "INVALID_ARGS",
        message: "Provide --hand or --hand-from stdin.",
      });
    }

    const strategy = args.strategy as string | undefined;
    const evaluation = await deps.engine.evaluateHand(hand, strategy);

    return ok({
      type: "evaluation",
      data: evaluation,
    });
  },
};
