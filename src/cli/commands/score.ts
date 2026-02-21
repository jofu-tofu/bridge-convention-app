import type { CommandDef } from "../types";
import { BidSuit, Seat, Vulnerability } from "../../engine/types";
import type { Contract } from "../../engine/types";
import { calculateScore } from "../../engine/scoring";
import type { CliError } from "../errors";

const STRAIN_MAP: Record<string, BidSuit> = {
  C: BidSuit.Clubs,
  D: BidSuit.Diamonds,
  H: BidSuit.Hearts,
  S: BidSuit.Spades,
  NT: BidSuit.NoTrump,
};

function parseContract(str: string): Contract {
  const upper = str.toUpperCase().trim();
  const match = upper.match(/^([1-7])(C|D|H|S|NT)(XX|X)?$/);
  if (!match) {
    const err: CliError = {
      code: "INVALID_ARGS",
      message: `Invalid contract string: "${str}". Expected format: 3NT, 4SX, 4SXX`,
    };
    throw err;
  }

  const level = Number(match[1]) as Contract["level"];
  const strain = STRAIN_MAP[match[2]!]!;
  const modifier = match[3] ?? "";

  return {
    level,
    strain,
    doubled: modifier === "X",
    redoubled: modifier === "XX",
    declarer: Seat.South,
  };
}

export const scoreCommand: CommandDef = {
  name: "score",
  description: "Calculate the score for a contract result",
  phase: 2,
  options: {
    contract: { type: "string", description: "Contract (e.g. 3NT, 4SX, 4SXX)" },
    tricks: { type: "string", description: "Tricks won by declarer (0-13)" },
    vulnerable: { type: "boolean", description: "Declarer is vulnerable" },
  },
  async handler(args) {
    if (!args.contract) {
      const err: CliError = { code: "INVALID_ARGS", message: "Missing --contract" };
      throw err;
    }
    if (args.tricks === undefined || args.tricks === null) {
      const err: CliError = { code: "INVALID_ARGS", message: "Missing --tricks" };
      throw err;
    }

    const contractStr = String(args.contract);
    const contract = parseContract(contractStr);
    const tricksWon = Number(args.tricks);
    const vulnerable = args.vulnerable === true;
    const vuln = vulnerable ? Vulnerability.Both : Vulnerability.None;

    const score = calculateScore(contract, tricksWon, vuln);

    return {
      type: "score",
      data: {
        score,
        contract: contractStr,
        tricks: tricksWon,
        vulnerable,
      },
    };
  },
};
