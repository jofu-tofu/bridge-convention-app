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

## Tier 1: CLI Coverage (Primary — Convention Correctness)

### Step 1: Determine Scope

**Ask the user what they want reviewed if they didn't specify.** Options:
- A specific bundle (e.g., `nt-bundle` for 1NT responses, Stayman, Jacoby Transfers)
- Everything (`--all`)

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

Parse the JSON output to get pass/fail/skip counts and identify failing atoms.

### Step 3: Enumerate Targets

Use `list` to get all coverage atoms:

```bash
npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle
```

Each JSON line contains `baseStateId`, `surfaceId`, `meaningId`, `meaningLabel`. These identify testable (state, surface) pairs.

### Step 4: Present and Grade Each Target

For each (state, surface) pair — especially those that failed in self-test — run the two-step agent protocol:

**Step 4a: Present the hand (NO answer shown)**
```bash
npx tsx src/cli/coverage-runner.ts present --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=42
```

Returns JSON with hand, HCP, auction, legal calls — no correct answer. The `--seed=42` flag ensures deterministic deals.

**Step 4b: Decide the bid**

Read the viewport output. As a bridge expert, determine the correct bid based on the hand, auction, and convention rules.

**Step 4c: Grade the bid**
```bash
npx tsx src/cli/coverage-runner.ts grade --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=42 --bid=CALL
```

Returns structured JSON with `yourBid`, `correctBid`, `grade`, `correct`, `requiresRetry`, `feedback`. Exit code 0=correct, 1=wrong.

**Step 4d: Retry if wrong**

If `grade` returns `"correct": false`, read the feedback, reassess, and submit a different bid with another `grade` call.

### Step 5: Categorize Results

| Category | What It Means | Action |
|----------|--------------|--------|
| **correct: true** | Correct call, correct feedback | No action needed |
| **correct: false — wrong correctBid** | The app recommends the wrong bid | CRITICAL finding — log state, surface, viewport, expected vs actual |
| **correct: false — bad feedback** | Correct call but explanation is wrong or misleading | MAJOR finding — log the feedback text and what's wrong with it |
| **requiresRetry: true** | Agent needed feedback to get right answer | Flag for review — may indicate unclear teaching |
| **selftest skip** | Strategy returned null (no recommendation) | Flag for review — may indicate coverage gap |

### Step 6: Analyze Findings

For each failure:

1. **Record the viewport** (from `present` output) — hand, auction, legal calls.
2. **Record expected vs actual** — what the app said (from `grade` `correctBid`) vs what bridge rules dictate.
3. **Verify correctness** — Use `webfetch` to check the convention rule against authoritative sources (bridgebum.com, larryco.com, bridgeguys.com). Every correctness claim must cite a URL you actually fetched.
4. **Classify severity** per `EvaluationFramework.md` severity definitions.
5. **Compute metrics:**
   - **First-attempt accuracy:** % of targets where `grade` returned `correct: true` on first try
   - **Post-feedback accuracy:** % where the correct call was made after reading `grade` feedback and retrying
   - **Selftest pass rate:** from `selftest` output
   - **Coverage:** total atoms tested / total atoms in the bundle

### Step 7: Generate CLI Report

```
# CLI Coverage Report

## Metrics
- **Targets tested:** N
- **First-attempt accuracy:** X%
- **Post-feedback accuracy:** Y%
- **Selftest pass rate:** P/T (X%)
- **Failures:** N

## Failures
### Failure 1: [convention] — [targetState] / [targetSurface]
- **Viewport:** [hand, auction, legal calls from `present`]
- **Expected call:** [what bridge rules say]
- **Actual call:** [what the app recommended via `grade`]
- **Feedback text:** [what the app said]
- **Reference:** [URL you fetched]
- **Severity:** CRITICAL / MAJOR

[...repeat for all failures...]

## Selftest Skips
| Bundle | Atom | Details |
|--------|------|---------|
```

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

Each agent receives this prompt, customized with their assignment:

---

You are evaluating the **convention correctness** of a bridge bidding practice app using its CLI coverage-runner. You must use the `exec` tool to run CLI commands and the `read` tool to examine source files. **Do NOT invoke the browser skill or use Playwright. Do NOT navigate to any URLs in a browser. All evaluation is done via CLI and source code.**

## Your Assignment

{ASSIGNMENT}

## CLI Commands

The coverage-runner provides these commands. Run them via `exec` from `/home/joshua-fu/projects/bridge-convention-app`:

```bash
# List all coverage atoms for a bundle (JSON lines)
npx tsx src/cli/coverage-runner.ts list --bundle=<bundleId>

# Present a hand — returns hand, HCP, auction, legal calls (no correct answer)
npx tsx src/cli/coverage-runner.ts present --bundle=<bundleId> --target=<stateId> --surface=<surfaceId> --seed=<N>

# Grade a bid — returns correctBid, grade, correct, feedback
npx tsx src/cli/coverage-runner.ts grade --bundle=<bundleId> --target=<stateId> --surface=<surfaceId> --seed=<N> --bid=<CALL>

# Self-test — strategy vs itself across all atoms
npx tsx src/cli/coverage-runner.ts selftest --bundle=<bundleId> --seed=42
npx tsx src/cli/coverage-runner.ts selftest --all --seed=42
```

Available bundle IDs: `nt-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`

Same seed = same deal across `present` and `grade`. Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.

## Source Code Locations

Use `read` to examine these files for deeper analysis:

- **Convention specs:** `src/conventions/definitions/<bundle>/convention-spec.ts`
- **Convention modules:** `src/conventions/definitions/<bundle>/modules/`
- **Coverage enumeration:** `src/conventions/core/protocol/coverage-enumeration.ts`
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
2. **Evidence is mandatory.** Every finding needs CLI output (`present`/`grade` JSON) or source code excerpts as evidence.
3. **Bridge expertise required.** Verify convention rules against authoritative sources using `webfetch`. Every correctness claim must cite a URL you actually fetched.
4. **Structured output.** Report findings in the format below.
5. **Be thorough.** Run `present`/`grade` for at least 10 coverage atoms per convention in your scope.

## Report Format

```
# {ASSIGNMENT_NAME} — CLI Evaluation Report

## Summary Verdict
[PASS / FAIL / CONDITIONAL PASS]

## Findings

### Finding 1: [Title]
- **Bundle:** [bundleId]
- **Atom:** [baseStateId / surfaceId]
- **Seed:** [seed used]
- **Hand:** [from `present` output]
- **Expected call:** [from bridge rules + reference]
- **App's call:** [from `grade` correctBid]
- **Feedback:** [from `grade` feedback]
- **Reference:** [URL you fetched]
- **Severity:** CRITICAL / MAJOR / MINOR

## Selftest Results
[Output from `selftest` command if run]

## Atoms Reviewed
| Bundle | Atom | Surface | Seed | Your Bid | App Bid | Match? |
|--------|------|---------|------|----------|---------|--------|
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
