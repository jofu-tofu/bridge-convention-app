import type { CommandDef } from "../types";
import { err } from "../types";

export const solveCommand: CommandDef = {
  name: "solve",
  description: "Run DDS solver on a deal (V2)",
  phase: 6,
  options: {
    "deal-from": {
      type: "string",
      description: "Read deal from source (stdin)",
    },
  },
  async handler() {
    return err({
      code: "NOT_IMPLEMENTED",
      message: "solve command is phase-gated",
    });
  },
};
