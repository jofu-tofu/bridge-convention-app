import type { CommandDef } from "../types";

export const conventionsCommand: CommandDef = {
  name: "conventions",
  description: "List or inspect available conventions",
  phase: 2,
  options: {
    list: { type: "boolean", short: "l", description: "List all conventions" },
    show: { type: "string", description: "Show details for a convention" },
  },
  async handler() {
    throw new Error("Unreachable: conventions command is phase-gated");
  },
};
