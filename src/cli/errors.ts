import type { OutputFormat } from "./types";

export type CliErrorCode =
  | "NOT_IMPLEMENTED"
  | "INVALID_ARGS"
  | "ENGINE_ERROR"
  | "PARSE_ERROR";

export interface CliError {
  readonly code: CliErrorCode;
  readonly message: string;
  readonly phase?: number;
  readonly suggestion?: string;
}

export function formatError(error: CliError, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify({ error }, null, 2);
  }
  let msg = `Error [${error.code}]: ${error.message}`;
  if (error.phase !== undefined) {
    msg += `\n  Phase: ${error.phase}`;
  }
  if (error.suggestion) {
    msg += `\n  Suggestion: ${error.suggestion}`;
  }
  return msg;
}
