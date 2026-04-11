// ── CLI usage and per-subcommand help ───────────────────────────────

export function printUsage(): void {
  console.error("Usage: main.ts <subcommand> [options]");
  console.error("");
  console.error("Subcommands:");
  console.error("  bundles                                    List all available bundles (JSON)");
  console.error("  modules                                    List all available modules (JSON)");
  console.error("  describe  --bundle=<id>                    Inspect a bundle and its modules");
  console.error("  play      --bundle=<id> --seed=N [--bid=X] Session-based playthrough");
  console.error("  selftest  --bundle=<id> | --all [--seed=N] Strategy self-consistency check");
  console.error("  help                                       Show this help");
  console.error("");
  console.error("Global settings:");
  console.error("  --system=<sayc|two-over-one|acol>  Base bidding system (default: sayc)");
  console.error("  --vuln=<none|ns|ew|both>           Vulnerability (default: none)");
  console.error("  --opponents=<natural|none>          Opponent bidding mode (default: natural)");
  console.error("  --help                             Show help (global or per-subcommand)");
  console.error("");
  console.error("Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error");
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
      console.error("Returns JSON array of bundles with id, name, description.");
      console.error("Use this for self-discovery: find valid bundle IDs before calling other commands.");
      break;

    case "modules":
      console.error("modules — List all available convention modules.");
      console.error("");
      console.error("Usage: main.ts modules");
      console.error("");
      console.error("Returns JSON array of modules with id, displayName, bundleId, etc.");
      break;

    case "describe":
      console.error("describe — Inspect a single bundle and its modules.");
      console.error("");
      console.error("Usage: main.ts describe --bundle=<id>");
      console.error("");
      console.error("Returns JSON with bundle metadata and its modules.");
      break;

    case "play":
      console.error("play — Session-based playthrough evaluation.");
      console.error("");
      console.error("Usage:");
      console.error("  play --bundle=<id> --seed=N");
      console.error("    Returns BiddingViewport JSON for user's first decision point.");
      console.error("");
      console.error("  play --bundle=<id> --seed=N --bid=<bid>");
      console.error("    Creates session (same seed = same deal), submits bid.");
      console.error("    Returns grade + teaching feedback + next viewport.");
      console.error("    Exit code: 0=correct/acceptable, 1=wrong.");
      console.error("");
      console.error("  play --bundle=<id> --seed=N --bids=2C,3NT");
      console.error("    Replays earlier bids silently, grades final bid.");
      console.error("    --bids contains user-seat bids only (AI bids are automatic).");
      console.error("");
      console.error("Options:");
      console.error("  --bundle=<id>       Convention/bundle ID (required)");
      console.error("  --seed=N            Deterministic PRNG seed (default: 42)");
      console.error("  --system=<id>       Base system (default: sayc)");
      console.error("  --vuln=<v>          Vulnerability (default: none)");
      console.error("  --opponents=<mode>  Opponent mode (default: natural)");
      console.error("  --module=<id>       Target module focus");
      console.error("  --role=<role>       Practice role (opener/responder/both)");
      console.error("  --mode=<mode>       Practice mode (decision-drill/full-auction)");
      console.error("  --bid=<bid>         Submit a single bid (P, X, XX, 1C..7NT)");
      console.error("  --bids=<b1,b2,...>  Submit multiple user-seat bids in sequence");
      console.error("");
      console.error("Bid format: P (pass), X (double), XX (redouble), 1C..7NT");
      break;

    case "selftest":
      console.error("selftest — Run strategy against itself (self-consistency check).");
      console.error("");
      console.error("Usage:");
      console.error("  selftest --bundle=<id> [--seed=N] [--count=N]");
      console.error("  selftest --all [--seed=N] [--count=N]");
      console.error("");
      console.error("For each seed: creates session, gets strategy's recommended bid via");
      console.error("getExpectedBid(), submits it, and verifies it grades as correct.");
      console.error("Requires a dev WASM build (npm run wasm:dev).");
      console.error("");
      console.error("Options:");
      console.error("  --bundle=<id>   Convention/bundle ID");
      console.error("  --all           Test all bundles");
      console.error("  --seed=N        Starting seed (default: 42)");
      console.error("  --count=N       Number of seeds to test (default: 20)");
      console.error("  --system=<id>   Base system (default: sayc)");
      console.error("");
      console.error("Exit code: 0=all pass, 1=at least one failure.");
      break;

    default:
      console.error(`Unknown subcommand: "${cmd}"`);
      console.error("");
      printUsage();
      break;
  }
}
