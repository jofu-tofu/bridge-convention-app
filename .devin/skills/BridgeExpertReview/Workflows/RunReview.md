# RunReview Workflow

> **Trigger:** "run bridge review", "evaluate bridge app", "bridge expert review", "adversarial bridge test"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md` — Agent personas, bridge reference, evaluation criteria, report format
- **SKILL.md:** `../SKILL.md` — Skill overview and routing

## Purpose

Orchestrate a two-tier adversarial review of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to test every (state, surface) pair for convention correctness — this is fast, comprehensive, and handles 95% of testing. **Tier 2 (Browser)** spawns specialist subagents to validate UI rendering that the CLI cannot assess: suit symbols, layout, alert display, and teaching feedback presentation.

**Key architecture:** The app provides a PlayerViewport information boundary:
- **BiddingViewport** — what the player sees (hand, auction, alerts, legal calls)
- **EvaluationOracle** — answer key (never exposed to the agent)
- **ViewportBidFeedback** — post-bid feedback explaining correctness

The CLI coverage-runner exercises this boundary headlessly across all (state, surface) pairs.

---

## Tier 1: CLI Coverage (Primary — Convention Correctness)

### Step 1: Determine Scope

**Ask the user what they want reviewed if they didn't specify.** Options:
- A specific bundle (e.g., `nt-bundle` for 1NT responses, Stayman, Jacoby Transfers)
- A specific convention within a bundle
- Everything (`--all`)

### Step 2: Run CLI Coverage Runner

Run the headless coverage-runner. This tests every (state, surface) pair via the optimized two-phase algorithm without needing a browser or dev server.

**Full coverage (all bundles):**
```bash
cd /home/joshua-fu/projects/bridge-convention-app
npx tsx src/cli/coverage-runner.ts --all --json --seed=42
```

**Targeted bundle:**
```bash
npx tsx src/cli/coverage-runner.ts --bundle=nt-bundle --json --seed=42
```

The `--seed=42` flag ensures deterministic, reproducible results. The `--json` flag produces structured output.

### Step 3: Parse CLI JSON Output

The CLI produces structured JSON with these fields per target:

```json
{
  "convention": "nt-bundle",
  "targetState": "opener-rebid-after-stayman",
  "targetSurface": "bid-2H",
  "viewport": {
    "hand": "♠AK73 ♥QJ84 ♦K9 ♣A52",
    "auction": ["1NT", "2♣"],
    "alerts": ["15-17 HCP"],
    "legalCalls": ["2♦", "2♥", "2♠", "Pass"]
  },
  "expectedCall": "2♥",
  "actualCall": "2♥",
  "firstAttemptCorrect": true,
  "postFeedbackCorrect": true,
  "feedback": "Correct! With both 4-card majors, bid hearts first (up-the-line).",
  "result": "PASS"
}
```

Parse the JSON and categorize results:

| Category | What It Means | Action |
|----------|--------------|--------|
| **PASS** | Correct call, correct feedback | No action needed |
| **FAIL — wrong expected call** | The app recommends the wrong bid | CRITICAL finding — log state, surface, viewport, expected vs actual |
| **FAIL — bad feedback** | Correct call but explanation is wrong or misleading | MAJOR finding — log the feedback text and what's wrong with it |
| **FAIL — first attempt wrong, post-feedback correct** | Agent needed feedback to get right answer | Flag for review — may indicate unclear UI, not necessarily a bug |
| **INFEASIBLE** | No deal can reach this (state, surface) pair | Expected for some pairs — log but don't flag as error |

### Step 4: Analyze CLI Results

For each failure:

1. **Record the BiddingViewport** — this is what the player sees. Include hand, auction, alerts, legal calls.
2. **Record expected vs actual** — what the app said vs what bridge rules dictate.
3. **Verify correctness** — Use `webfetch` to check the convention rule against authoritative sources (bridgebum.com, larryco.com, bridgeguys.com). Every correctness claim must cite a URL you actually fetched.
4. **Classify severity** per `EvaluationFramework.md` severity definitions.
5. **Compute metrics:**
   - **First-attempt accuracy:** % of targets where the correct call was made on first try
   - **Post-feedback accuracy:** % where the correct call was made after seeing feedback
   - **Infeasible pair count:** how many (state, surface) pairs are unreachable
   - **Coverage:** total targets tested / total targets in the bundle

### Step 5: Generate CLI Report

```
# CLI Coverage Report

## Metrics
- **Targets tested:** N
- **First-attempt accuracy:** X%
- **Post-feedback accuracy:** Y%
- **Infeasible pairs:** Z
- **Failures:** N

## Failures
### Failure 1: [convention] — [targetState] / [targetSurface]
- **Viewport:** [hand, auction, alerts]
- **Expected call:** [what bridge rules say]
- **Actual call:** [what the app recommended]
- **Feedback text:** [what the app said]
- **Reference:** [URL you fetched]
- **Severity:** CRITICAL / MAJOR

[...repeat for all failures...]

## Infeasible Pairs
| Convention | Target State | Target Surface | Why Infeasible |
|-----------|-------------|---------------|----------------|
```

---

## Tier 2: Browser UI Validation (Secondary — Rendering & UX)

**Run this tier only after Tier 1 completes.** The CLI handles logic correctness; the browser validates what the user actually sees on screen.

### Step 6: Build and Serve a Stable Snapshot

Build a production snapshot and serve it on a stable port:

```bash
cd /home/joshua-fu/projects/bridge-convention-app
npm run build
npm run preview -- --port 4173 &
```

Wait for the preview server to respond on port 4173. If the build fails, fall back to the dev server on port 1420 (warn the user that HMR may cause instability).

### Step 7: Smoke-Check the App

Before spawning browser agents, verify the app loads. Write a quick Playwright script that:

1. Navigates to http://localhost:4173
2. Takes a screenshot
3. Checks that the home screen rendered (not a WASM error, blank page, or crash)

If the app didn't load, **stop and tell the user** — don't spawn agents against a broken build.

### Step 8: Load Evaluation Framework

Read `../Standards/EvaluationFramework.md` to get agent personas, bridge references, and the structured report format.

### Step 9: Spawn Browser UI Agents

Launch **3 parallel subagents** using `run_subagent` with `profile: "subagent_general"`. Browser agents focus ONLY on UI rendering — the CLI already validated convention logic.

**All 3 agents run as background subagents** (`is_background: true`) so they execute in parallel.

**Focus browser agents on failures from Tier 1.** If the CLI found failures, direct browser agents to those specific states using coverage URLs:
```
http://localhost:4173/?convention=X&targetState=Y&targetSurface=Z
```

#### Agent Assignments

| Agent | Focus | What to Check |
|-------|-------|---------------|
| **UI Rendering Agent** | Suit symbols, card display, hand layout | Suit colors (♠♣ black, ♥♦ red), card grouping by suit, rank order within suits, HCP display accuracy |
| **Alert & Annotation Agent** | Alert badges, announcement text, feedback display | Alerts appear on the right bids, alert text describes meaning not just "Alert", feedback messages render completely, no truncation |
| **Navigation & Flow Agent** | Page transitions, coverage drill-down, convention picker | Coverage URL scheme works (?coverage=true), target links navigate correctly, back button works, no state loss |

#### Browser Agent Prompt Template

Each browser agent receives this prompt, customized with their assignment:

---

You are evaluating the **UI rendering** of a bridge bidding practice app. Convention correctness has already been validated by the CLI coverage-runner — your job is to verify that what the user SEES on screen is correct.

**You are NOT testing bid logic.** The CLI already did that. You are testing:
- Do suit symbols render correctly? (♠♣ black, ♥♦ red)
- Do cards display in correct order? (AKQJT98765432 within each suit)
- Do alerts appear on the right bids with meaningful text?
- Does feedback render completely without truncation?
- Do coverage URLs navigate to the right states?
- Is the layout usable and clear?

## Your Assignment

{ASSIGNMENT}

## How to Interact

The app runs at http://localhost:4173 (stable production build). Use Playwright:

```bash
npx playwright open "http://localhost:4173"
```

### Coverage Drill-Down URLs

Use these to navigate directly to specific states:
- `http://localhost:4173/?coverage=true` — bundle picker
- `http://localhost:4173/?coverage=true&convention=X` — bundle's targets
- `http://localhost:4173/?convention=X&targetState=Y&targetSurface=Z` — specific (state, surface) drill

{CLI_FAILURE_URLS}

### Focus Areas from CLI Failures

The CLI found these failures. Navigate to each and verify what the UI shows:

{CLI_FAILURES_SUMMARY}

## Rules

1. **Browser only.** Use Playwright to interact. Navigate, click, screenshot, read.
2. **No source code.** You evaluate what you SEE, not what was written.
3. **UI focus.** Do NOT re-test bid logic. The CLI is authoritative for correctness. You test rendering.
4. **Evidence is mandatory.** Every finding needs a screenshot path or DOM text excerpt.
5. **Keep exploring.** Navigate the coverage drill-down, try multiple conventions, check edge cases.

## Report Format

```
# {ASSIGNMENT_NAME} — UI Review Report

## Summary Verdict
[PASS / FAIL / CONDITIONAL PASS]

## UI Issues Found
### Issue 1: [Title]
- **What I saw:** [screenshot or text excerpt]
- **What is correct:** [expected rendering]
- **URL tested:** [the URL where this was found]
- **Severity:** CRITICAL / MAJOR / MINOR
- **Evidence:** [screenshot path]

## Scenarios Tested
| URL | What I Checked | Result |
|-----|----------------|--------|
```

Test at least 10 distinct screens/states.

---

### Step 10: Wait and Collect

All 3 browser agents run in background. When each completes, read its output. Store raw reports.

### Step 11: Merge Tier 1 + Tier 2

Combine CLI coverage results with browser UI findings:

1. CLI failures are the primary issue list (convention correctness)
2. Browser findings supplement with UI rendering issues
3. If a CLI failure is confirmed by a browser agent seeing wrong UI, boost severity
4. Browser-only issues (rendering bugs the CLI can't detect) go in a separate UI section

### Step 12: Hand Off to CompileFeedback

Invoke the CompileFeedback workflow to:
1. Merge CLI JSON results with browser agent reports
2. Deduplicate findings
3. Sort by severity: CRITICAL > MAJOR > MINOR
4. Produce a single prioritized action list
5. Report coverage metrics from CLI

### Step 13: Present Results

Output the compiled report to the user with:
- **CLI metrics:** first-attempt accuracy, post-feedback accuracy, infeasible pairs, coverage %
- Total issues found per severity (CLI + browser)
- Top 5 most critical findings with full evidence
- Recommended fix priority order
- Coverage summary (% of (state, surface) pairs tested, any gaps)
- Overall verdict (would an expert bridge player trust this app?)
