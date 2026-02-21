import type { CommandDef } from "../types";
import {
  listConventions,
  getConvention,
} from "../../conventions/registry";
import type { CliError } from "../errors";

export const conventionsCommand: CommandDef = {
  name: "conventions",
  description: "List or inspect available conventions",
  phase: 2,
  options: {
    list: { type: "boolean", short: "l", description: "List all conventions" },
    show: { type: "string", description: "Show details for a convention" },
  },
  async handler(args) {
    if (args.list) {
      const conventions = listConventions();
      return {
        type: "conventions",
        data: conventions.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          category: c.category,
        })),
      };
    }

    if (args.show) {
      const id = String(args.show);
      try {
        const convention = getConvention(id);
        return {
          type: "convention",
          data: {
            id: convention.id,
            name: convention.name,
            description: convention.description,
            category: convention.category,
            rules: convention.biddingRules.map((r) => r.name),
          },
        };
      } catch {
        const err: CliError = {
          code: "INVALID_ARGS",
          message: `Unknown convention: "${id}"`,
        };
        throw err;
      }
    }

    const err: CliError = {
      code: "INVALID_ARGS",
      message: "Provide --list or --show <id>",
    };
    throw err;
  },
};
