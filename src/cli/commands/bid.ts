import type { CommandDef } from "../types";

export const bidCommand: CommandDef = {
  name: "bid",
  description: "Make a bid in an auction",
  phase: 2,
  options: {
    seat: { type: "string", short: "s", description: "Bidding seat (N|E|S|W)" },
    convention: { type: "string", short: "c", description: "Convention to use" },
  },
  async handler() {
    // PhaseGate in runner.ts prevents this from being called
    throw new Error("Unreachable: bid command is phase-gated");
  },
};
