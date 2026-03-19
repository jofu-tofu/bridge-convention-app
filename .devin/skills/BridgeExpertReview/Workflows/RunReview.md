# RunReview Workflow

> **Trigger:** "run bridge review", "evaluate bridge app", "bridge expert review", "adversarial bridge test"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md` — Agent personas, bridge reference, evaluation criteria, report format
- **SKILL.md:** `../SKILL.md` — Skill overview and routing

## Purpose

Orchestrate a two-tier adversarial review of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to test every coverage atom for convention correctness — fast, comprehensive, deterministic. **Tier 2 (CLI Agents)** spawns specialist subagents that use the same CLI to deep-dive into specific conventions or problem areas. All evaluation is CLI-based — agents use `exec` and `read`, never the browser skill.

**Key architecture:** The app provides a PlayerViewport information boundary:
- **BiddingViewport** — what the player sees (hand, auction, alerts, legal calls)
- **EvaluationOracle** — answer key (never exposed to the agent)
- **ViewportBidFeedback** — post-bid feedback explaining correctness

The CLI coverage-runner exercises this boundary headlessly across all (state, surface) pairs.

---

## CLI Reference

All four subcommands use `--flag=value` syntax. Same seed = same deal across `present` and `grade`. Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.

```bash
# List all coverage atoms for a bundle (JSON lines)
npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle

# Present a hand — agent reads viewport, decides bid (no correct answer shown)
npx tsx src/cli/coverage-runner.ts present --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=42

# Grade a bid — submit a call, get structured JSON feedback
npx tsx src/cli/coverage-runner.ts grade --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=42 --bid=2C

# Self-test — strategy bids against itself across all atoms
npx tsx src/cli/coverage-runner.ts selftest --bundle=nt-bundle --seed=42
npx tsx src/cli/coverage-runner.ts selftest --all --seed=42
```

Available bundle IDs: `nt-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`.

### `grade` JSON response shape

```json
{
  "bundle": "nt-bundle",
  "target": "STATE",
  "surface": "SURFACE",
  "seed": 42,
  "yourBid": "2C",
  "correctBid": "2C",
  "grade": "correct",
  "correct": true,
  "requiresRetry": false,
  "explanation": "...",
  "meaning": "...",
  "feedback": "Correct!"
}
```

### `selftest` JSON response shape

```json
{
  "seed": 42,
  "totalAtoms": 36,
  "pass": 34,
  "fail": 1,
  "skip": 1,
  "results": [
    { "bundle": "nt-bundle", "atom": "stateId/surfaceId/meaningId", "status": "pass", "correctBid": "2C" },
    { "bundle": "nt-bundle", "atom": "stateId/surfaceId/meaningId", "status": "fail", "details": "..." }
  ]
}
```

---

## Tier 1: CLI Coverage (Primary — Orchestrator Setup)

### Step 1: Determine Scope

**Ask the user what they want reviewed if they didn't specify.** Options:
- A specific bundle (e.g., `nt-bundle` for 1NT responses, Stayman, Jacoby Transfers)
- Everything (run for each bundle)

### Step 2: Self-Test Baseline

Run the self-test first to get a quick pass/fail overview:

```bash
cd /home/joshua-fu/projects/bridge-convention-app
npx tsx src/cli/coverage-runner.ts selftest --all --seed=42
```

Or for a single bundle:
```bash
npx tsx src/cli/coverage-runner.ts selftest --bundle=nt-bundle --seed=42
```

Parse the JSON output to get pass/fail/skip counts. This gives the orchestrator a quick health check before spawning agents.

### Step 3: Generate the Plan

Decide how many agents to spawn (see Tier 2 guidelines), then run the planner:

```bash
npx tsx src/cli/coverage-runner.ts plan --bundle=nt-bundle --agents=N --coverage=2
```

This precomputes playthroughs across many seeds, uses greedy set cover to find the minimal set covering every reachable atom at least 2x, and splits them across N agents balanced by user bid count. The output is a JSON plan with per-agent seed assignments.

Check the plan output for:
- **`atomsCoveredAtTarget`** — how many atoms reached 2x coverage
- **`uncoveredAtoms`** — atoms the planner couldn't cover (may need more seeds or indicate strategy gaps)
- **`agents`** — per-agent seed lists and bid counts (should be roughly balanced)

### Step 4: Review Plan and Spawn Agents

Use the plan output to spawn agents (see Tier 2). Each agent receives its seed list and follows the playthrough protocol.

---

## Tier 2: CLI Evaluation Agents (Convention Correctness Deep-Dive)

**Run this tier after Tier 1 completes.** The orchestrator handles the initial pass; CLI agents deep-dive into specific conventions or problem areas using the same CLI.

### Step 8: Prepare CLI Agent Context

Gather context for the spawned agents:

1. Collect the `selftest` JSON output and Tier 1 report from Steps 2-7.
2. Read `../Standards/EvaluationFramework.md` for agent personas and bridge references.
3. Identify which conventions/atoms need deeper investigation.

### Step 9: Spawn CLI Evaluation Agents

Spawn parallel subagents using `run_subagent` with `profile: "subagent_general"`. All agents evaluate convention correctness using the CLI coverage-runner and source code analysis. **Do NOT use the browser skill or Playwright.**

**All agents run as background subagents** (`is_background: true`) so they execute in parallel.

**Focus agents on Tier 1 findings.** If the orchestrator found issues, direct agents to those specific conventions and atoms.

#### How Many Agents to Spawn

The orchestrator decides the number and focus of agents based on the review scope. Use your judgment — more conventions in scope means more agents. Some guidelines:

- **Single convention** (e.g., `nt-bundle`): 1-2 agents may suffice (one for convention logic, one for teaching content).
- **Multiple conventions** (e.g., `nt-bundle` + `bergen-bundle`): Consider one agent per convention, or split by concern (logic vs. teaching) across conventions.
- **All conventions**: Consider one agent per convention (4 agents), or group related conventions. You can also add a dedicated coverage-completeness agent that cross-checks all conventions.
- **Large scope with many Tier 1 findings**: Spawn additional agents to focus on specific problem areas.

There is no fixed agent count. Assign each agent a clear, non-overlapping scope so they don't duplicate work.

#### Agent Focus Areas

Choose from these focus areas when defining agent assignments. Each agent should cover one or more:

| Focus Area | What to Check |
|-----------|---------------|
| **Convention logic** (for a specific bundle) | Run `present`/`grade` loops for coverage atoms. Verify the strategy's recommended bids against authoritative bridge sources. |
| **Teaching & feedback** (for a specific bundle) | Grade intentionally wrong bids and verify the feedback text is accurate, not misleading. Read convention spec source for teaching labels. |
| **Coverage completeness** (across bundles) | Run `selftest --all`. Cross-reference atoms against expected convention states. Identify skips, verify failure reasons, check edge cases. |
| **Alert & annotation rules** (across bundles) | Read convention module source. Verify alert/announce annotations match ACBL regulations. |

#### CLI Agent Prompt Template

Each agent receives this prompt, customized with their assignment and seed list:

---

You are evaluating the **convention correctness** of a bridge bidding practice app using its CLI coverage-runner. You must use the `exec` tool to run CLI commands and the `read` tool to examine source files. **Do NOT invoke the browser skill or use Playwright. Do NOT navigate to any URLs in a browser. All evaluation is done via CLI and source code.**

## Your Assignment

{ASSIGNMENT}

## Your Seeds

You have been assigned these seeds to evaluate: {SEEDS}

For each seed, follow the playthrough protocol below.

## Playthrough Protocol

For each assigned seed, evaluate one playthrough at a time:

**1. Get the step count:**
```bash
npx tsx src/cli/coverage-runner.ts trace --bundle=<bundleId> --seed=<N> --phase=present
```
This returns `totalSteps` — the number of user decision points.

**2. For each step (0 to totalSteps-1), one at a time:**
```bash
npx tsx src/cli/coverage-runner.ts trace --bundle=<bundleId> --seed=<N> --phase=present --step=<i>
```
This returns a viewport: the player's hand, HCP, auction so far, and legal calls. **No recommendation is shown.** You must decide the correct bid using bridge knowledge before proceeding.

**3. Commit your answer**, then request the next step. The next step's auction will reveal what the strategy bid — but you've already committed.

**4. Stop on disagreement.** If at any step your answer differs from the strategy's bid (visible in the next step's auction, or in the reveal), **stop evaluating this playthrough**. Record the finding and move to the next seed. Do NOT evaluate subsequent steps — their context is based on a bid you believe is wrong.

**5. After all steps (or after stopping), get the reveal:**
```bash
npx tsx src/cli/coverage-runner.ts trace --bundle=<bundleId> --seed=<N> --phase=reveal
```
This shows every decision point (user + partner auto-bids) with the strategy's recommendations and atom IDs. Compare your committed answers against the strategy's. Also check partner auto-bids visible in the auction — flag any that look incorrect.

## Reference Verification

When you disagree with the strategy's bid, use `webfetch` to verify your answer against authoritative bridge sources (bridgebum.com, larryco.com, bridgeguys.com). Every correctness claim must cite a URL you actually fetched.

## Source Code Locations

Use `read` to examine these files for deeper analysis:

- **Convention specs:** `src/conventions/definitions/<bundle>/convention-spec.ts`
- **Convention modules:** `src/conventions/definitions/<bundle>/modules/`
- **Viewport boundary:** `src/core/viewport/build-viewport.ts`
- **Teaching resolution:** `src/teaching/teaching-resolution.ts`
- **Strategy adapter:** `src/strategy/bidding/protocol-adapter.ts`

## Evaluation Framework

{EVALUATION_FRAMEWORK}

## Tier 1 Findings

The orchestrator found these issues. Focus your analysis on these areas:

{TIER1_FINDINGS}

## Rules

1. **CLI and source code only.** Use `exec` to run coverage-runner commands. Use `read` to examine source files. Use `webfetch` to check bridge references. **Do NOT use the browser skill or Playwright.**
2. **Stop on first error per playthrough.** If the strategy's bid is wrong at step N, do not evaluate steps N+1, N+2, etc. Record the finding and move to the next seed.
3. **Commit before peeking.** Decide your answer for each step BEFORE requesting the next step or the reveal. Do not revise earlier answers based on later information.
4. **Evidence is mandatory.** Every finding needs the viewport JSON (hand, auction) and a bridge reference URL.
5. **Bridge expertise required.** Verify convention rules against authoritative sources using `webfetch`. Every correctness claim must cite a URL you actually fetched.

## Report Format

```
# {ASSIGNMENT_NAME} — CLI Evaluation Report

## Summary Verdict
[PASS / FAIL / CONDITIONAL PASS]

## Playthroughs Evaluated
| Seed | Steps Evaluated | Steps Skipped | Findings |
|------|----------------|---------------|----------|

## Findings

### Finding 1: [Title]
- **Seed:** [seed]
- **Step:** [step index in playthrough]
- **Bundle:** [bundleId]
- **Hand:** [from viewport — suits and HCP]
- **Auction:** [auction so far]
- **My answer:** [what you decided]
- **App's answer:** [from reveal — strategy recommendation]
- **Why mine is correct:** [bridge reasoning + reference URL]
- **Severity:** CRITICAL / MAJOR / MINOR
- **Subsequent steps skipped:** [number of steps not evaluated due to this error]

## Partner Auto-Bid Issues
[Any incorrect partner bids noticed in the auction context]

## Playthroughs Passed
[Seeds where all steps matched — briefly note what was tested]
```

---

### Step 10: Wait and Collect

All CLI agents run in background. When each completes, read its output. Store raw reports.

### Step 11: Merge Tier 1 + Tier 2

Combine orchestrator results with CLI agent findings:

1. Orchestrator findings are the initial issue list (from Tier 1 selftest + present/grade)
2. CLI agent findings supplement with deep convention analysis
3. If an orchestrator finding is confirmed by a CLI agent, boost confidence
4. CLI-agent-only findings (deeper issues the orchestrator missed) go in a separate section

### Step 12: Hand Off to CompileFeedback

Invoke the CompileFeedback workflow to:
1. Merge orchestrator results with CLI agent reports
2. Deduplicate findings
3. Sort by severity: CRITICAL > MAJOR > MINOR
4. Produce a single prioritized action list
5. Report coverage metrics from CLI

### Step 13: Present Results

Output the compiled report to the user with:
- **CLI metrics:** first-attempt accuracy, post-feedback accuracy, selftest pass rate
- Total issues found per severity (orchestrator + CLI agents)
- Top 5 most critical findings with full evidence
- Recommended fix priority order
- Coverage summary (atoms per bundle, pass/fail/skip)
- Overall verdict (would an expert bridge player trust this app?)
