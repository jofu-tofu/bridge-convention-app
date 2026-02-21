import type { CommandDef } from "../types";

export const simulateCommand: CommandDef = {
  name: "simulate",
  description: "Simulate a full deal with AI bidding",
  phase: 3,
  options: {
    convention: { type: "string", short: "c", description: "Convention to drill" },
    count: { type: "string", short: "n", description: "Number of simulations" },
  },
  async handler() {
    throw new Error("Unreachable: simulate command is phase-gated");
  },
};
