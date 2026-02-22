import { Seat, Suit, Vulnerability } from "../../engine/types";
import type { DealConstraints, SeatConstraint } from "../../engine/types";
import type { CommandDef } from "../types";
import { ok, err } from "../types";

function parseSuit(s: string): Suit | undefined {
  const map: Record<string, Suit> = {
    S: Suit.Spades,
    H: Suit.Hearts,
    D: Suit.Diamonds,
    C: Suit.Clubs,
  };
  return map[s.toUpperCase()];
}

function parseSeat(s: string): Seat | undefined {
  const map: Record<string, Seat> = {
    N: Seat.North,
    E: Seat.East,
    S: Seat.South,
    W: Seat.West,
  };
  return map[s.toUpperCase()];
}

function parseVulnerability(s: string): Vulnerability | undefined {
  const map: Record<string, Vulnerability> = {
    none: Vulnerability.None,
    ns: Vulnerability.NorthSouth,
    ew: Vulnerability.EastWest,
    both: Vulnerability.Both,
  };
  return map[s.toLowerCase()];
}

function parseSuitLength(
  value: string,
): { suit: Suit; count: number } | undefined {
  const match = /^([SHDC])=(\d+)$/i.exec(value);
  if (!match) return undefined;
  const suit = parseSuit(match[1]!);
  const count = parseInt(match[2]!, 10);
  if (!suit || isNaN(count)) return undefined;
  return { suit, count };
}

export const generateCommand: CommandDef = {
  name: "generate",
  description: "Generate a random deal with optional constraints",
  phase: 1,
  options: {
    seat: {
      type: "string",
      short: "s",
      description: "Seat to constrain (N|E|S|W)",
    },
    "min-hcp": { type: "string", description: "Minimum HCP for seat" },
    "max-hcp": { type: "string", description: "Maximum HCP for seat" },
    balanced: {
      type: "boolean",
      short: "b",
      description: "Require balanced hand",
    },
    "min-length": {
      type: "string",
      description: "Minimum suit length (e.g. S=5)",
    },
    "max-length": {
      type: "string",
      description: "Maximum suit length (e.g. H=3)",
    },
    dealer: {
      type: "string",
      short: "d",
      description: "Dealer seat (default: N)",
    },
    vulnerability: {
      type: "string",
      short: "v",
      description: "Vulnerability (None|NS|EW|Both)",
    },
    diagnostics: {
      type: "boolean",
      description: "Include iteration/relaxation data",
    },
  },
  async handler(args, deps) {
    const seatConstraints: SeatConstraint[] = [];

    if (args.seat) {
      const seat = parseSeat(args.seat as string);
      if (!seat) {
        return err({
          code: "INVALID_ARGS",
          message: `Invalid seat: ${args.seat as string}. Use N, E, S, or W.`,
        });
      }

      const sc: {
        seat: Seat;
        minHcp?: number;
        maxHcp?: number;
        balanced?: boolean;
        minLength?: Partial<Record<Suit, number>>;
        maxLength?: Partial<Record<Suit, number>>;
      } = { seat };

      if (args["min-hcp"] !== undefined) {
        sc.minHcp = parseInt(args["min-hcp"] as string, 10);
        if (isNaN(sc.minHcp)) {
          return err({
            code: "INVALID_ARGS",
            message: "Invalid --min-hcp value.",
          });
        }
      }
      if (args["max-hcp"] !== undefined) {
        sc.maxHcp = parseInt(args["max-hcp"] as string, 10);
        if (isNaN(sc.maxHcp)) {
          return err({
            code: "INVALID_ARGS",
            message: "Invalid --max-hcp value.",
          });
        }
      }
      if (args.balanced) {
        sc.balanced = true;
      }
      if (args["min-length"]) {
        const parsed = parseSuitLength(args["min-length"] as string);
        if (!parsed) {
          return err({
            code: "INVALID_ARGS",
            message: "Invalid --min-length. Use format S=5.",
          });
        }
        sc.minLength = { [parsed.suit]: parsed.count };
      }
      if (args["max-length"]) {
        const parsed = parseSuitLength(args["max-length"] as string);
        if (!parsed) {
          return err({
            code: "INVALID_ARGS",
            message: "Invalid --max-length. Use format H=3.",
          });
        }
        sc.maxLength = { [parsed.suit]: parsed.count };
      }

      seatConstraints.push(sc);
    }

    const constraints: DealConstraints = {
      seats: seatConstraints,
      dealer: args.dealer ? parseSeat(args.dealer as string) : undefined,
      vulnerability: args.vulnerability
        ? parseVulnerability(args.vulnerability as string)
        : undefined,
    };

    const start = Date.now();
    const result = await deps.engine.generateDealWithDiagnostics(constraints);
    const durationMs = Date.now() - start;

    if (args.diagnostics) {
      return ok({
        type: "deal",
        data: result.deal,
        meta: {
          iterations: result.iterations,
          relaxationSteps: result.relaxationSteps,
          durationMs,
        },
      });
    }

    return ok({
      type: "deal",
      data: result.deal,
    });
  },
};
