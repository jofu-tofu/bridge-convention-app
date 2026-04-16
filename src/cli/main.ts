#!/usr/bin/env -S npx tsx
// ── Bridge Convention CLI ────────────────────────────────────────────
//
// Session-based CLI for convention evaluation. Uses the same session API
// as the UI: createDrillSession → startDrill → submitBid.
//
// Subcommands:
//   bundles   — list all available bundles
//   modules   — list all available modules
//   describe  — inspect a bundle and its modules
//   play      — session-based playthrough (viewport, bid grading)
//   selftest  — strategy self-consistency check

import { BridgeService } from "../service";
import { parseArgs } from "./shared";
import { runBundles, runModules, runDescribe } from "./commands/info";
import { runPlay } from "./commands/play";
import { runSelftest } from "./commands/selftest";
import { printUsage, printSubcommandHelp } from "./help";

// ── Main dispatch ───────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const subcommand = rawArgs[0];
const flags = parseArgs(rawArgs.slice(1));

if (!subcommand || subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
  printUsage();
  process.exit(subcommand ? 0 : 2);
}

// Per-subcommand --help
if (flags["help"] === true || flags["h"] === true) {
  printSubcommandHelp(subcommand);
  process.exit(0);
}

// ── Service instance (requires WASM) ──────────────────────────────
async function main(): Promise<void> {
  const service = new BridgeService();
  await service.init();

  // Activate verbose tracing if requested (must run after init so WASM is loaded)
  if (flags["verbose"] === true || flags["v"] === true) {
    const level = typeof flags["verbose"] === "string" ? flags["verbose"] : "debug";
    const wasm = await import("../../crates/bridge-wasm/pkg/bridge_wasm.js");
    wasm.set_verbose(level);
  }

  switch (subcommand) {
    case "bundles":
      await runBundles(service);
      break;
    case "modules":
      await runModules(service);
      break;
    case "describe":
      await runDescribe(service, flags);
      break;
    case "play":
      await runPlay(service, flags);
      break;
    case "selftest":
      await runSelftest(service, flags);
      break;
    default:
      console.error(`Unknown subcommand: "${subcommand}"`);
      printUsage();
      process.exit(2);
  }
}

void main();
