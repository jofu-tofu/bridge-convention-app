// ── CLI usage and per-subcommand help ───────────────────────────────

import { printAvailableBundles } from "./shared";

export function printUsage(): void {
  console.error("Usage: main.ts <subcommand> [options]");
  console.error("");
  console.error("Subcommands:");
  console.error("  bundles                                    List all available bundles (JSON)");
  console.error("  describe  --bundle=<id>                    Inspect a bundle (atoms, depth, coverage)");
  console.error("  list      --bundle=<id>                    List all coverage atoms (JSON lines)");
  console.error("  eval      --bundle=<id> --atom=<id> --seed=N [--bid=<bid>]");
  console.error("                                             Per-atom evaluation (Phase 1)");
  console.error("  play      --bundle=<id> --seed=N [--step=N] [--bid=<bid>] [--reveal]");
  console.error("                                             Playthrough evaluation (Phase 2)");
  console.error("  selftest  --bundle=<id> | --all [--seed=N] Strategy self-test (CI)");
  console.error("  plan      --bundle=<id> --agents=N [...]   Precompute evaluation plan");
  console.error("  help                                       Show this help");
  console.error("");
  console.error("Global settings:");
  console.error("  --vuln=<none|ns|ew|both>        Vulnerability (default: none)");
  console.error("  --opponents=<natural|none>       Opponent bidding mode (default: none)");
  console.error("  --help                           Show help (global or per-subcommand)");
  console.error("");
  console.error("Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error");
  console.error("");
  console.error("Available bundles:");
  printAvailableBundles();
  console.error("");
  console.error("Tip: Run '<subcommand> --help' for detailed subcommand usage.");
}

export function printSubcommandHelp(cmd: string): void {
  switch (cmd) {
    case "bundles":
      console.error("bundles — List all available convention bundles.");
      console.error("");
      console.error("Usage: main.ts bundles");
      console.error("");
      console.error("Returns JSON array of bundles with id, name, description, atomCount.");
      console.error("Use this for self-discovery: find valid bundle IDs before calling other commands.");
      break;

    case "describe":
      console.error("describe — Inspect a single bundle in detail.");
      console.error("");
      console.error("Usage: main.ts describe --bundle=<id>");
      console.error("");
      console.error("Returns JSON with:");
      console.error("  - Bundle metadata (id, name, description, category)");
      console.error("  - Total atom count and max BFS depth");
      console.error("  - Strategy coverage (how many atoms the strategy handles)");
      console.error("  - Per-state breakdown (stateId, depth, atomCount)");
      console.error("  - Full atom list with atomId, meaningLabel, depth");
      console.error("");
      console.error("Tip: Use atom IDs from describe output with 'eval --atom=<id>'.");
      break;

    case "list":
      console.error("list — Enumerate all coverage atoms for a bundle.");
      console.error("");
      console.error("Usage: main.ts list --bundle=<id>");
      console.error("");
      console.error("Outputs one JSON object per line (JSON lines format).");
      console.error("Each line has: baseStateId, surfaceId, meaningId, meaningLabel.");
      console.error("");
      console.error("Atom ID format: <baseStateId>/<surfaceId>/<meaningId>");
      console.error("Use these IDs with 'eval --atom=<atomId>'.");
      break;

    case "eval":
      console.error("eval — Per-atom targeted evaluation (Phase 1, orchestrator-driven).");
      console.error("");
      console.error("Usage:");
      console.error("  eval --bundle=<id> --atom=<atomId> --seed=N");
      console.error("    Returns sanitized viewport: seat, hand, hcp, auction, legalCalls.");
      console.error("    No correct answer — agent must decide based on bridge knowledge.");
      console.error("");
      console.error("  eval --bundle=<id> --atom=<atomId> --seed=N --bid=<bid>");
      console.error("    Submits a bid. Returns viewport + grade + teaching feedback.");
      console.error("    Exit code: 0=correct/acceptable, 1=wrong.");
      console.error("");
      console.error("Grades: correct, correct-not-preferred, acceptable, near-miss, incorrect");
      console.error("");
      console.error("Bid format: P (pass), X (double), XX (redouble), 1C..7NT");
      break;

    case "play":
      console.error("play — Playthrough evaluation (Phase 2, agent-driven).");
      console.error("");
      console.error("Usage:");
      console.error("  play --bundle=<id> --seed=N");
      console.error("    Start: returns { totalSteps, step: <first viewport> }");
      console.error("");
      console.error("  play --bundle=<id> --seed=N --step=N");
      console.error("    Get viewport for step N (no bid yet).");
      console.error("");
      console.error("  play --bundle=<id> --seed=N --step=N --bid=<bid>");
      console.error("    Submit bid: returns grade + teaching + nextStep viewport.");
      console.error("    One fewer round-trip than separate step + bid calls.");
      console.error("    Exit code: 0=correct/acceptable, 1=wrong.");
      console.error("");
      console.error("  play --bundle=<id> --seed=N --reveal");
      console.error("    Full trace: all steps with recommendations and atom IDs.");
      break;

    case "selftest":
      console.error("selftest — Run strategy against itself for all atoms (CI mode).");
      console.error("");
      console.error("Usage:");
      console.error("  selftest --bundle=<id> [--seed=N]");
      console.error("  selftest --all [--seed=N]");
      console.error("");
      console.error("Tests each atom: generates deal, runs strategy, verifies determinism.");
      console.error("Results: pass (strategy recommends a bid), skip (null), fail (non-deterministic).");
      console.error("Exit code: 0=no failures, 1=at least one failure.");
      break;

    case "plan":
      console.error("plan — Precompute two-phase evaluation plan.");
      console.error("");
      console.error("Usage:");
      console.error("  plan --bundle=<id> --agents=N [--coverage=2] [--max-seeds=500] [--seed=0]");
      console.error("");
      console.error("Output:");
      console.error("  phase1 — Per-atom BFS-ordered list with atomId, expectedBid, seeds, depth.");
      console.error("           Includes dependencyGraph for stop-on-error propagation.");
      console.error("           Orchestrator-private: never sent to agents.");
      console.error("           phase1.agents — Atom batches distributed across N agents.");
      console.error("             Each agent gets subtree-preserving atom batches (parent-child");
      console.error("             atoms stay together) with per-agent dependencySubgraph.");
      console.error("             Balanced by estimated eval calls (atoms × coverage).");
      console.error("");
      console.error("  phase2 — Seed assignments per agent, balanced by step count.");
      console.error("           Agent-facing: agents use 'play' to walk these seeds.");
      break;

    default:
      console.error(`Unknown subcommand: "${cmd}"`);
      console.error("");
      printUsage();
      break;
  }
}
