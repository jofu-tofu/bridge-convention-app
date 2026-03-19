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

All subcommands use `--flag=value` syntax. Same seed = same deal across calls. Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.

```bash
# List all coverage atoms for a bundle (JSON lines)
npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle

# Per-atom evaluation — viewport only (no answer)
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=42

# Per-atom evaluation — submit bid, get full teaching feedback
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=42 --bid=2C

# Playthrough — get step count + first viewport
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=42

# Playthrough — step through with grading (returns next viewport too)
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=42 --step=0 --bid=2H

# Self-test — strategy bids against itself across all atoms
npx tsx src/cli/coverage-runner.ts selftest --bundle=nt-bundle --seed=42
npx tsx src/cli/coverage-runner.ts selftest --all --seed=42
```

Available bundle IDs: `nt-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`.

### `eval --bid` JSON response shape

```json
{
  "viewport": { "seat": "S", "hand": {}, "hcp": 14, "auction": [], "legalCalls": [] },
  "yourBid": "2C",
  "correctBid": "2C",
  "grade": "correct",
  "correct": true,
  "acceptable": false,
  "feedback": { "grade": "correct", "conditions": [], "conventionsApplied": [] },
  "teaching": { "primaryExplanation": [], "whyNot": [], "ambiguityScore": 0 }
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

## Tier 1: Selftest Baseline (Quick Health Check)

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

Parse the JSON output to get pass/fail/skip counts. This gives the orchestrator a quick health check before launching the two-phase evaluation pipeline.

### Step 3: Generate the Plan

Decide how many agents to spawn for Phase 2, then run the planner:

```bash
npx tsx src/cli/coverage-runner.ts plan --bundle=nt-bundle --agents=N --coverage=2
```

The plan output now contains **two sections**:

- **`phase1`** — Per-atom list with BFS ordering, dependency graph, seeds, and expected bids. **This is orchestrator-private — NEVER sent to agents.** The orchestrator uses it to drive Phase 1 and track stop-on-error propagation.
- **`phase2`** — Playthrough seed assignments per agent, balanced by step count. Each agent receives only its seed list.

Check the plan output for:
- **Coverage gaps** — atoms the planner couldn't cover (may need more seeds or indicate strategy gaps)
- **Uncovered atoms** — atoms with no valid seeds
- **Agent balance** — per-agent seed lists and step counts (should be roughly balanced)

---

## Phase 1: Per-Atom Targeted Evaluation (Orchestrator-Driven)

The orchestrator walks every coverage atom in BFS order, presents sanitized viewports to the evaluation agent, collects bids, grades them, and enforces stop-on-error propagation using the dependency graph. **The agent NEVER sees atom IDs, expected bids, or the dependency tree.**

### Step 4: Walk Atoms in BFS Order

Using `phase1.atoms` from the plan (already sorted by BFS depth), process each atom:

**1. Pick the first available seed for the atom.**

**2. Call `eval` to get a sanitized viewport:**
```bash
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=N
```

The `eval` output is always sanitized. The output contains ONLY:
- Hand (suits and HCP)
- Auction so far
- Legal calls

No atom ID, seed, or expected bid is included — the agent sees only what a human player would see.

**3. Present the sanitized viewport to the evaluation agent:**

> "Given this hand and auction, what should South bid?"

The agent decides using bridge knowledge alone. It has no hint about what atom is being tested or what the expected bid is.

**4. Submit the agent's bid for evaluation:**
```bash
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=N --bid=AGENT_BID
```

This returns the full teaching feedback including grade, correct bid, conventions applied, and teaching explanations.

**5. Feed the evaluation feedback back to the agent (inline feedback).**

The agent sees whether it was correct, the app's bid, the convention meaning, and teaching feedback. This allows the agent to learn from mistakes within the session.

### Step 5: Stop-on-Error Propagation

When an evaluation comes back wrong:

1. **Record the finding** — sanitized viewport, agent bid, correct bid, feedback from eval JSON.
2. **Look up the atom's `stateId`** in `phase1.dependencyGraph`.
3. **Collect all descendant states** — children, grandchildren, etc. recursively.
4. **Mark all atoms in descendant states as polluted** — skip them entirely.
5. **Continue** to the next non-polluted atom at the same or lesser BFS depth.
6. **Log:** `"Skipping N atoms in subtree of [stateId] due to upstream failure"`

This prevents testing deeper atoms whose auction context depends on a bid already found to be wrong. Testing them would produce meaningless results — the auction would already be in a state the agent disagrees with.

### Step 6: Record Phase 1 Results

Compile the following metrics:

| Metric | Description |
|--------|-------------|
| **Atoms tested** | Total atoms presented to the agent |
| **Atoms correct** | Agent bid matched the app |
| **Atoms wrong** | Agent bid differed from the app |
| **Atoms polluted (skipped)** | Skipped due to upstream failure — list which upstream atom caused each skip |
| **Coverage gaps** | Atoms with no valid seeds |

Findings list — each entry contains:
- Sanitized viewport (hand, auction, legal calls)
- Agent bid
- Correct bid (from eval)
- Feedback (from eval JSON)
- Severity (CRITICAL / MAJOR / MINOR)

---

## Phase 2: Playthrough Integration Testing (Agent-Driven)

Phase 2 tests end-to-end auction flow. While Phase 1 tests each atom in isolation, Phase 2 catches issues that per-atom testing misses — bids that are individually correct but don't compose into a coherent auction sequence.

### Step 7: Spawn Playthrough Agents

Using `phase2.agents` from the plan, spawn parallel subagents with `run_subagent` (profile: `"subagent_general"`, `is_background: true`).

Each agent receives **ONLY**:
- Bundle ID
- Their assigned seed list
- The playthrough protocol (below)

**NO state IDs, atom IDs, expected bids, or dependency tree information.**

#### How Many Agents to Spawn

The orchestrator decides the number of agents based on the review scope:

- **Single convention** (e.g., `nt-bundle`): 1-2 agents
- **Multiple conventions** (e.g., `nt-bundle` + `bergen-bundle`): One agent per convention
- **All conventions**: One agent per convention (4 agents), or group related conventions
- **Large scope with many Phase 1 findings**: Spawn additional agents to focus on problem areas

The plan's `phase2.agents` section provides pre-balanced seed assignments. Use them directly.

#### Playthrough Agent Prompt Template

Each agent receives this prompt, customized with their bundle and seed list:

---

You are evaluating the **convention correctness** of a bridge bidding practice app by playing through full auction sequences using its CLI. You must use the `exec` tool to run CLI commands, the `read` tool to examine source files, and `webfetch` to verify bridge rules against authoritative sources. **Do NOT invoke the browser skill or use Playwright. Do NOT navigate to any URLs in a browser. All evaluation is done via CLI and source code.**

## Your Assignment

- **Bundle:** {BUNDLE_ID}
- **Seeds:** {SEED_LIST}

For each seed, follow the playthrough protocol below. You are testing whether the app's bidding recommendations form a coherent, correct auction sequence.

## Playthrough Protocol

For each assigned seed, evaluate one complete playthrough:

**1. Get the step count + first viewport:**
```bash
npx tsx src/cli/coverage-runner.ts play --bundle={BUNDLE_ID} --seed=<N>
```
This returns `totalSteps` — the number of user decision points — and the first step's viewport.

**2. For each step (0 to totalSteps-1), one at a time:**

Study the viewport (hand, HCP, auction so far, legal calls). **No recommendation is shown.** Decide the correct bid using your bridge knowledge. **Commit to your bid before proceeding.**

Then, submit your bid:
```bash
npx tsx src/cli/coverage-runner.ts play --bundle={BUNDLE_ID} --seed=<N> --step=<i> --bid=<CALL>
```
This returns your bid + the app's recommendation + feedback + the next step's viewport. The response includes:
- `correct`: whether your bid matches the app's
- `correctBid`: what the app recommends
- `grade`: evaluation result (correct/wrong/acceptable)
- `feedback`: structured feedback with conventions applied
- `teaching`: teaching explanations including whyNot for wrong bids
- `nextStep`: the next step's viewport (if `complete: false`)
- `complete`: whether the playthrough is finished

**3. Evaluate the result:**
- If `correct: true` and you agree the app's bid is right → use `nextStep` viewport and continue.
- If `correct: false` and you think **your bid is right** (not the app's) → record a finding. The app is teaching something wrong. **Stop this playthrough** — subsequent steps are in a polluted auction context. Move to the next seed.
- If `correct: false` and you realize the app is right → note your mistake, use `nextStep` viewport and continue.

**4. After all steps (or after stopping), optionally get the full reveal:**
```bash
npx tsx src/cli/coverage-runner.ts play --bundle={BUNDLE_ID} --seed=<N> --reveal
```
This shows all decision points (user + partner auto-bids) with recommendations and atom IDs. Check partner auto-bids in the auction for any that look incorrect.

## Rules

1. **CLI and source code only.** Use `exec` to run coverage-runner commands. Use `read` to examine source files. Use `webfetch` to check bridge references. **Do NOT use the browser skill or Playwright.**
2. **Stop on first real error per playthrough.** If the strategy's bid is wrong at step N, do not evaluate steps N+1, N+2, etc. The auction context is polluted. Record the finding and move to the next seed.
3. **Commit before peeking.** Decide your answer for each step BEFORE submitting your bid. Do not revise earlier answers based on later information.
4. **Evidence is mandatory.** Every finding needs the viewport JSON (hand, auction) and a bridge reference URL.
5. **Bridge expertise required.** Verify convention rules against authoritative sources using `webfetch` (bridgebum.com, larryco.com, bridgeguys.com). Every correctness claim must cite a URL you actually fetched.

## Source Code Locations

Use `read` to examine these files for deeper analysis:

- **Convention specs:** `src/conventions/definitions/<bundle>/convention-spec.ts`
- **Convention modules:** `src/conventions/definitions/<bundle>/modules/`
- **Viewport boundary:** `src/core/viewport/build-viewport.ts`
- **Teaching resolution:** `src/teaching/teaching-resolution.ts`
- **Strategy adapter:** `src/strategy/bidding/protocol-adapter.ts`

## Phase 1 Findings

The orchestrator found these issues during per-atom targeted evaluation. Focus your analysis on these areas:

{PHASE1_FINDINGS}

## Report Format

```
# Playthrough Agent Report

## Summary
[PASS / FAIL / CONDITIONAL PASS]

## Playthroughs
| Seed | Steps Evaluated | Steps Skipped | Findings |
|------|----------------|---------------|----------|

## Findings
### Finding N: [Title]
- Seed: [seed]
- Step: [step index]
- Hand: [from viewport]
- Auction: [auction so far]
- My bid: [what agent decided]
- App bid: [from eval/play response]
- Why mine is correct: [bridge reasoning + reference URL]
- Severity: CRITICAL / MAJOR / MINOR

## Playthroughs Passed
[Seeds where all steps matched]
```

---

## Aggregation

### Step 8: Collect Results

Collect Phase 1 results (from orchestrator) and Phase 2 agent reports (from background subagents). Wait for all background agents to complete before proceeding.

### Step 9: Merge and Deduplicate

- **Phase 1 findings** are per-atom (targeted, precise) — they pinpoint exactly which coverage atom is wrong.
- **Phase 2 findings** are per-playthrough (integration, end-to-end) — they catch bids that are correct individually but don't compose into a coherent auction.
- **Cross-reference:** If the same atom appears in both phases as wrong, boost confidence in the finding.
- **Phase 2 unique findings:** Bids that Phase 1 marked correct but that produce broken auction sequences when composed. These go in a separate "integration-only" section.

### Step 10: Compile Report

Hand off to the CompileFeedback workflow with:

| Input | Description |
|-------|-------------|
| **Phase 1 metrics** | Atoms tested, atoms correct, atoms wrong, atoms polluted (skipped) |
| **Phase 2 metrics** | Playthroughs tested, playthroughs passed, findings count |
| **Combined findings** | Sorted by severity (CRITICAL > MAJOR > MINOR), deduplicated across phases |
| **Coverage summary** | Per-bundle atom counts, coverage gaps, uncovered atoms |
| **Overall verdict** | Would an expert bridge player trust this app? |

---

## Design Notes

### Sanitized Viewports (`eval`)

The `eval` command always returns sanitized output — there is no unsanitized mode. The viewport contains only what a human player would see: their hand, the auction so far, and their legal calls. No atom ID, seed, or expected bid is included. This is the key mechanism for keeping agent context clean and preventing answer-space leakage.

### Orchestrator-Private Plan Data

The plan's `phase1` section is orchestrator-private. It contains `expectedBid` and `stateId` for every atom — this **MUST NOT** be sent to agents. The orchestrator uses it to:
1. Call `eval` with the correct atom/seed arguments
2. Track the dependency graph for stop-on-error propagation
3. Map agent bids back to specific atoms for the findings report

The agents only ever see sanitized viewports. They never know which atom they're testing, what the expected bid is, or how atoms relate to each other in the convention tree.

### Source Code Locations

- **Convention specs:** `src/conventions/definitions/<bundle>/convention-spec.ts`
- **Convention modules:** `src/conventions/definitions/<bundle>/modules/`
- **Viewport boundary:** `src/core/viewport/build-viewport.ts`
- **Teaching resolution:** `src/teaching/teaching-resolution.ts`
- **Strategy adapter:** `src/strategy/bidding/protocol-adapter.ts`
