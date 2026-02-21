#!/usr/bin/env node

import { createCliDependencies } from "./engine-factory";
import { createCli } from "./runner";
import { formatError } from "./errors";
import type { CliError } from "./errors";

async function main(): Promise<void> {
  const deps = createCliDependencies();
  const cli = createCli(deps);
  const exitCode = await cli.run(process.argv.slice(2));
  process.exitCode = exitCode;
}

main().catch((err: unknown) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err
  ) {
    console.error(formatError(err as CliError, "json"));
  } else {
    console.error("Fatal error:", err);
  }
  process.exitCode = 1;
});
