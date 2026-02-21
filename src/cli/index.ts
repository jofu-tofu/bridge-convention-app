#!/usr/bin/env node

import { createCliDependencies } from "./engine-factory";
import { createCli } from "./runner";

async function main(): Promise<void> {
  const deps = createCliDependencies();
  const cli = createCli(deps);
  const exitCode = await cli.run(process.argv.slice(2));
  process.exitCode = exitCode;
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
