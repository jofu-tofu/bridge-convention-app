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

// ── Side-effect import: registers all bundles + conventions ─────────
import "../conventions";

import { parseArgs, parseVulnerability, parseOpponentMode } from "./shared";
import { runList, runBundles, runDescribe } from "./commands/info";
import { runEval } from "./commands/eval";
import { runSelftest } from "./commands/selftest";
import { runPlay } from "./commands/play";
import { runPlan } from "./commands/plan";
import { printUsage, printSubcommandHelp } from "./help";

// ── Main dispatch ───────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const subcommand = rawArgs[0];
const flags = parseArgs(rawArgs.slice(1));

// Settings flags (shared across subcommands)
const vuln = parseVulnerability(flags);
const opponentMode = parseOpponentMode(flags);

if (!subcommand || subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
  printUsage();
  process.exit(subcommand ? 0 : 2);
}

// Per-subcommand --help
if (flags["help"] === true || flags["h"] === true) {
  printSubcommandHelp(subcommand);
  process.exit(0);
}

switch (subcommand) {
  case "list":
    runList(flags);
    break;
  case "eval":
    runEval(flags, vuln);
    break;
  case "play":
    runPlay(flags, vuln, opponentMode);
    break;
  case "selftest":
    runSelftest(flags, vuln);
    break;
  case "plan":
    runPlan(flags, vuln, opponentMode);
    break;
  case "bundles":
    runBundles();
    break;
  case "describe":
    runDescribe(flags, vuln);
    break;
  default:
    console.error(`Unknown subcommand: "${subcommand}"`);
    printUsage();
    process.exit(2);
}
