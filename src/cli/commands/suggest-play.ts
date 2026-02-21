import type { CommandDef } from "../types";

export const suggestPlayCommand: CommandDef = {
  name: "suggest-play",
  description: "Suggest the best card to play (V2, DDS-powered)",
  phase: 6,
  options: {
    hand: { type: "string", short: "h", description: "Current hand" },
    trump: { type: "string", description: "Trump suit (S|H|D|C or NT)" },
  },
  async handler() {
    throw new Error("Unreachable: suggest-play command is phase-gated");
  },
};
