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

// ── Side-effect import: registers all bundles + conventions ─────────
import "../conventions";

import { createLocalService } from "../service";
import type { EnginePort } from "../engine/port";
import { parseArgs, parseVulnerability, parseOpponentMode, parseScenarioConfig, parseBaseSystem } from "./shared";
import { runList, runBundles, runSystems, runDescribe } from "./commands/info";
import { runEval } from "./commands/eval";
import { runSelftest } from "./commands/selftest";
import { runPlay } from "./commands/play";
import { runPlan } from "./commands/plan";
import { printUsage, printSubcommandHelp } from "./help";
import { runVerify } from "./verify";

// ── Service instance (evaluation methods don't use the engine) ──────
// Evaluation methods use dynamic imports to the evaluation facade;
// session-based methods are unused by CLI eval/play commands.
const stubEngine = {} as EnginePort;
const service = createLocalService(stubEngine);

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

switch (subcommand) {
  case "list":
    runList(flags, baseSystem);
    break;
  case "eval":
    void runEval(service, flags, parseVulnerability(flags), baseSystem);
    break;
  case "play":
    void runPlay(service, flags, parseVulnerability(flags), parseOpponentMode(flags), baseSystem);
    break;
  case "selftest":
    runSelftest(flags, parseVulnerability(flags), baseSystem);
    break;
  case "plan":
    runPlan(flags, parseScenarioConfig(flags), baseSystem);
    break;
  case "bundles":
    runBundles();
    break;
  case "systems":
    runSystems();
    break;
  case "describe":
    runDescribe(flags, parseVulnerability(flags), baseSystem);
    break;
  case "verify": {
    const verifySubcommand = rawArgs[1];
    const verifyFlags = parseArgs(rawArgs.slice(2));
    if (!verifySubcommand || verifyFlags["help"] === true || verifyFlags["h"] === true) {
      printSubcommandHelp("verify");
      process.exit(verifySubcommand ? 0 : 2);
    }
    runVerify(verifySubcommand, verifyFlags);
    break;
  }
  default:
    console.error(`Unknown subcommand: "${subcommand}"`);
    printUsage();
    process.exit(2);
}
