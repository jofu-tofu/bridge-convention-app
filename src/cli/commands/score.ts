import type { CommandDef } from "../types";

export const scoreCommand: CommandDef = {
  name: "score",
  description: "Calculate the score for a contract result",
  phase: 2,
  options: {
    contract: { type: "string", description: "Contract (e.g. 3NT, 4S)" },
    tricks: { type: "string", description: "Tricks won" },
    vulnerable: { type: "boolean", description: "Declarer is vulnerable" },
  },
  async handler() {
    throw new Error("Unreachable: score command is phase-gated");
  },
};
