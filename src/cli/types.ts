import type { EnginePort } from "../engine/port";
import type { CliError } from "./errors";

export type OutputFormat = "json" | "text";

export type Result<T, E> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

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
  readonly readStdin: () => Promise<Result<CommandResult, CliError>>;
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
  ): Promise<Result<CommandResult, CliError>>;
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
