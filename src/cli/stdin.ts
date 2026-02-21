import type { CommandResult } from "./types";
import type { CliError } from "./errors";

export interface StdinSource {
  readonly isTTY?: boolean;
  [Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
}

export async function readStdin(
  stdin: StdinSource = process.stdin as StdinSource,
): Promise<CommandResult> {
  if (stdin.isTTY) {
    const error: CliError = {
      code: "INVALID_ARGS",
      message:
        "No piped input detected. Use --hand instead, or pipe from another command.",
    };
    throw error;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    const error: CliError = {
      code: "PARSE_ERROR",
      message: "Empty input from stdin.",
    };
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const error: CliError = {
      code: "PARSE_ERROR",
      message: "Invalid JSON from stdin.",
    };
    throw error;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    !("data" in parsed)
  ) {
    const error: CliError = {
      code: "PARSE_ERROR",
      message:
        'Malformed CommandResult envelope: missing "type" or "data" field.',
    };
    throw error;
  }

  return parsed as CommandResult;
}
