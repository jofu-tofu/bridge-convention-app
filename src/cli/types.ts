import type { EnginePort } from "../engine/port";

export type OutputFormat = "json" | "text";

export interface CommandResult {
  readonly type: string;
  readonly data: unknown;
  readonly meta?: {
    readonly iterations?: number;
    readonly relaxationSteps?: number;
    readonly durationMs?: number;
  };
}

export interface CliDependencies {
  readonly engine: CliEngine;
  readonly output: (message: string) => void;
  readonly errorOutput: (message: string) => void;
  readonly readStdin: () => Promise<CommandResult>;
}

export interface CliEngine extends EnginePort {
  generateDealWithDiagnostics(
    constraints: import("../engine/types").DealConstraints,
  ): Promise<import("../engine/types").DealGeneratorResult>;
}

export interface CommandHandler {
  (
    args: Record<string, unknown>,
    deps: CliDependencies,
  ): Promise<CommandResult>;
}

export interface CommandDef {
  readonly name: string;
  readonly description: string;
  readonly phase: number;
  readonly options: {
    readonly [key: string]: {
      readonly type: "string" | "boolean";
      readonly short?: string;
      readonly description?: string;
    };
  };
  readonly handler: CommandHandler;
}
