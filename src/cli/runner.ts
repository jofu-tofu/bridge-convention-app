import { parseArgs } from "node:util";
import type { CliDependencies, CommandDef, OutputFormat } from "./types";
import { CURRENT_PHASE, PHASE_DESCRIPTIONS } from "./constants";
import type { CliError } from "./errors";
import { formatError } from "./errors";
import { formatResult } from "./formatter";
import { generateCommand } from "./commands/generate";
import { evaluateCommand } from "./commands/evaluate";
import { bidCommand } from "./commands/bid";
import { scoreCommand } from "./commands/score";
import { conventionsCommand } from "./commands/conventions";
import { simulateCommand } from "./commands/simulate";
import { solveCommand } from "./commands/solve";
import { suggestPlayCommand } from "./commands/suggest-play";

const ALL_COMMANDS: CommandDef[] = [
  generateCommand,
  evaluateCommand,
  bidCommand,
  scoreCommand,
  conventionsCommand,
  simulateCommand,
  solveCommand,
  suggestPlayCommand,
];

function printHelp(output: (msg: string) => void): void {
  output("bridge - Bridge convention practice CLI\n");
  output("Usage: bridge <command> [options]\n");

  const available = ALL_COMMANDS.filter((c) => c.phase <= CURRENT_PHASE);
  const future = ALL_COMMANDS.filter((c) => c.phase > CURRENT_PHASE);

  if (available.length > 0) {
    output("Available commands:");
    for (const cmd of available) {
      output(`  ${cmd.name.padEnd(16)} ${cmd.description}`);
    }
  }

  if (future.length > 0) {
    output("\nComing soon:");
    const byPhase = new Map<number, CommandDef[]>();
    for (const cmd of future) {
      const list = byPhase.get(cmd.phase) ?? [];
      list.push(cmd);
      byPhase.set(cmd.phase, list);
    }
    for (const [phase, cmds] of [...byPhase.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const desc = PHASE_DESCRIPTIONS[phase] ?? `Phase ${phase}`;
      output(`  Phase ${phase} — ${desc}:`);
      for (const cmd of cmds) {
        output(`    ${cmd.name.padEnd(16)} ${cmd.description}`);
      }
    }
  }

  output("\nGlobal options:");
  output("  --format <json|text>  Output format (default: json)");
  output("  --no-unicode          Disable suit symbols (use S/H/D/C)");
  output("  --help                Show this help message");
  output("  --version             Show version");
}

function printCommandHelp(
  cmd: CommandDef,
  output: (msg: string) => void,
): void {
  output(`bridge ${cmd.name} — ${cmd.description}\n`);
  output("Options:");
  for (const [key, opt] of Object.entries(cmd.options)) {
    const shortFlag = opt.short ? `-${opt.short}, ` : "    ";
    const desc = opt.description ?? "";
    output(`  ${shortFlag}--${key.padEnd(16)} ${desc}`);
  }
}

export function createCli(deps: CliDependencies) {
  const commandMap = new Map<string, CommandDef>();
  for (const cmd of ALL_COMMANDS) {
    commandMap.set(cmd.name, cmd);
  }

  return {
    async run(argv: string[]): Promise<number> {
      // Parse global flags first
      const { values: globalValues, positionals } = parseArgs({
        args: argv,
        options: {
          help: { type: "boolean" },
          version: { type: "boolean" },
          format: { type: "string" },
          "no-unicode": { type: "boolean" },
        },
        allowPositionals: true,
        strict: false,
      });

      if (globalValues.version) {
        // Dynamic import to avoid bundling issues
        try {
          const { createRequire } = await import("node:module");
          const require = createRequire(import.meta.url);
          const pkg = require("../../package.json") as { version: string };
          deps.output(pkg.version);
        } catch {
          deps.output("unknown");
        }
        return 0;
      }

      const commandName = positionals[0];

      if (globalValues.help || !commandName) {
        if (commandName) {
          const cmd = commandMap.get(commandName);
          if (cmd) {
            printCommandHelp(cmd, deps.output);
            return 0;
          }
        }
        printHelp(deps.output);
        return 0;
      }

      const format: OutputFormat =
        (globalValues.format as OutputFormat) ?? "json";
      const unicode = !globalValues["no-unicode"];

      const cmd = commandMap.get(commandName);
      if (!cmd) {
        const error: CliError = {
          code: "INVALID_ARGS",
          message: `Unknown command: ${commandName}`,
          suggestion: "Run 'bridge --help' to see available commands.",
        };
        deps.errorOutput(formatError(error, format));
        return 1;
      }

      // Phase gate
      if (cmd.phase > CURRENT_PHASE) {
        const phaseDesc =
          PHASE_DESCRIPTIONS[cmd.phase] ?? `Phase ${cmd.phase}`;
        const error: CliError = {
          code: "NOT_IMPLEMENTED",
          message: `'${cmd.name}' is not yet available (requires Phase ${cmd.phase}: ${phaseDesc}).`,
          phase: cmd.phase,
          suggestion: `Current phase: ${CURRENT_PHASE}. This command will be available when Phase ${cmd.phase} ships.`,
        };
        deps.errorOutput(formatError(error, format));
        return 1;
      }

      // Parse command-specific options
      const commandArgv = argv.slice(argv.indexOf(commandName) + 1);

      // Check for --help on the command
      if (commandArgv.includes("--help")) {
        printCommandHelp(cmd, deps.output);
        return 0;
      }

      const { values } = parseArgs({
        args: commandArgv,
        options: {
          ...cmd.options,
          format: { type: "string" },
          "no-unicode": { type: "boolean" },
        },
        allowPositionals: false,
        strict: false,
      });

      let result;
      try {
        result = await cmd.handler(
          values as Record<string, unknown>,
          deps,
        );
      } catch (thrown: unknown) {
        const cliError: CliError = {
          code: "ENGINE_ERROR",
          message: thrown instanceof Error ? thrown.message : String(thrown),
        };
        deps.errorOutput(formatError(cliError, format));
        return 1;
      }

      if (!result.success) {
        deps.errorOutput(formatError(result.error, format));
        return 1;
      }

      const output = formatResult(result.value, format, { unicode });
      if (format === "json") {
        deps.output(JSON.stringify(result.value, null, 2));
      } else {
        deps.output(output);
      }
      return 0;
    },
  };
}
