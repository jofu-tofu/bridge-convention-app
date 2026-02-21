import type { CommandResult } from "./types";
import { ok, err, type Result } from "./types";
import type { CliError } from "./errors";

export interface StdinSource {
  readonly isTTY?: boolean;
  [Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
}

export async function readStdin(
  stdin: StdinSource = process.stdin as StdinSource,
): Promise<Result<CommandResult, CliError>> {
  if (stdin.isTTY) {
    return err({
      code: "INVALID_ARGS",
      message:
        "No piped input detected. Use --hand instead, or pipe from another command.",
    });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return err({
      code: "PARSE_ERROR",
      message: "Empty input from stdin.",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err({
      code: "PARSE_ERROR",
      message: "Invalid JSON from stdin.",
    });
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    !("data" in parsed)
  ) {
    return err({
      code: "PARSE_ERROR",
      message:
        'Malformed CommandResult envelope: missing "type" or "data" field.',
    });
  }

  return ok(parsed as CommandResult);
}
