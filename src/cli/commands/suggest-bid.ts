import type { CommandDef } from "../types";

export const suggestBidCommand: CommandDef = {
  name: "suggest-bid",
  description: "Suggest the best bid for a hand and auction state",
  phase: 3,
  options: {
    hand: { type: "string", short: "h", description: "Hand to evaluate" },
    convention: { type: "string", short: "c", description: "Convention context" },
  },
  async handler() {
    throw new Error("Unreachable: suggest-bid command is phase-gated");
  },
};
