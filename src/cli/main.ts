#!/usr/bin/env -S npx tsx
// ── Bridge Convention Coverage CLI ──────────────────────────────────
//
// Protocol-frame-aware coverage runner for convention evaluation.
//
// Subcommands:
//   list      — enumerate all coverage atoms for a bundle
//   eval      — per-atom evaluation (--atom, optional --bid for grading)
//   play      — playthrough evaluation (--step, --bid, --reveal)
//   selftest  — run strategy against itself for all atoms (CI)
//   plan      — precompute two-phase evaluation plan
//   bundles   — list all available bundles
//   describe  — inspect a bundle in detail
//   verify    — compositional verification (lint, interfere, explore, motif, fuzz, preflight)

import { initWasmService, WasmService } from "../service";
import { parseArgs, parseVulnerability, parseOpponentMode, parseBaseSystem } from "./shared";
import { runEval } from "./commands/eval";
import { runPlay } from "./commands/play";
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

const baseSystem = parseBaseSystem(flags);

// ── Service instance (requires WASM) ──────────────────────────────
// CLI now requires `npm run wasm:build` before running.
async function main(): Promise<void> {
  await initWasmService();
  const service = new WasmService();

  switch (subcommand) {
    case "eval":
      await runEval(service, flags, parseVulnerability(flags), baseSystem);
      break;
    case "play":
      await runPlay(service, flags, parseVulnerability(flags), parseOpponentMode(flags), baseSystem);
      break;
    // Commands that depended on the TS backend (list, bundles, systems, describe,
    // selftest, plan, verify) have been removed. Their functionality is now in
    // Rust/WASM and will be re-exposed through WasmService methods.
    case "list":
    case "bundles":
    case "systems":
    case "describe":
    case "selftest":
    case "plan":
    case "verify":
      console.error(`Subcommand "${subcommand}" has been removed — functionality moved to Rust/WASM.`);
      process.exit(2);
      break;
    default:
      console.error(`Unknown subcommand: "${subcommand}"`);
      printUsage();
      process.exit(2);
  }
}

void main();
