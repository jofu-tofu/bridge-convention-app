import type { CommandDef } from "../types";
import { ok, err } from "../types";
import { BidSuit, Seat, Vulnerability } from "../../engine/types";
import type { Contract } from "../../engine/types";
import { calculateScore } from "../../engine/scoring";
import type { CliError } from "../errors";
import type { Result } from "../types";
import type { CommandResult } from "../types";

const STRAIN_MAP: Record<string, BidSuit> = {
  C: BidSuit.Clubs,
  D: BidSuit.Diamonds,
  H: BidSuit.Hearts,
  S: BidSuit.Spades,
  NT: BidSuit.NoTrump,
};

function parseContract(str: string): Result<Contract, CliError> {
  const upper = str.toUpperCase().trim();
  const match = upper.match(/^([1-7])(C|D|H|S|NT)(XX|X)?$/);
  if (!match) {
    return err({
      code: "INVALID_ARGS",
      message: `Invalid contract string: "${str}". Expected format: 3NT, 4SX, 4SXX`,
    });
  }

  const level = Number(match[1]) as Contract["level"];
  const strain = STRAIN_MAP[match[2]!]!;
  const modifier = match[3] ?? "";

  return ok({
    level,
    strain,
    doubled: modifier === "X",
    redoubled: modifier === "XX",
    declarer: Seat.South,
  });
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
      return err({ code: "INVALID_ARGS", message: "Missing --contract" });
    }
    if (args.tricks === undefined || args.tricks === null) {
      return err({ code: "INVALID_ARGS", message: "Missing --tricks" });
    }

    const contractStr = String(args.contract);
    const contractResult = parseContract(contractStr);
    if (!contractResult.success) {
      return contractResult;
    }
    const contract = contractResult.value;
    const tricksWon = Number(args.tricks);
    const vulnerable = args.vulnerable === true;
    const vuln = vulnerable ? Vulnerability.Both : Vulnerability.None;

    const score = calculateScore(contract, tricksWon, vuln);

    return ok({
      type: "score",
      data: {
        score,
        contract: contractStr,
        tricks: tricksWon,
        vulnerable,
      },
    });
  },
};
