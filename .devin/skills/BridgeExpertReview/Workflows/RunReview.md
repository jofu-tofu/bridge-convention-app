# RunReview Workflow

> **Trigger:** "run bridge review", "evaluate bridge app", "bridge expert review", "adversarial bridge test"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md` — Agent personas, bridge reference, evaluation criteria, report format
- **SKILL.md:** `../SKILL.md` — Skill overview and routing

## Purpose

Orchestrate a two-tier adversarial review of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to test every coverage atom for convention correctness — fast, comprehensive, deterministic. **Tier 2 (CLI Agents)** spawns specialist subagents that use the same CLI to deep-dive into specific conventions or problem areas. Both Phase 1 (per-atom) and Phase 2 (playthrough) evaluation are parallelized across agents. All evaluation is CLI-based — agents use `exec` and `read`, never the browser skill.

**Key architecture:** The app provides a PlayerViewport information boundary:
- **BiddingViewport** — what the player sees (hand, auction, alerts, legal calls)
- **EvaluationOracle** — answer key (never exposed to the agent)
- **ViewportBidFeedback** — post-bid feedback explaining correctness

The CLI coverage-runner exercises this boundary headlessly across all (state, surface) pairs.

---

## Step 0: Worktree Setup

The review runs in a **disposable git worktree** so the main working tree stays free for development. All CLI commands, source code reads, and agent work happen inside the worktree. The worktree is removed automatically when the review completes (see [Worktree Cleanup](#worktree-cleanup)).

```bash
# Create a detached worktree from HEAD at a temp location
REVIEW_DIR="/tmp/bridge-expert-review-$$"
git -C /home/joshua-fu/projects/bridge-convention-app worktree add --detach "$REVIEW_DIR" HEAD

# Install dependencies (fast — uses lockfile)
cd "$REVIEW_DIR" && npm ci --ignore-scripts
```

> **`REVIEW_DIR` is the root for everything below.** Every CLI command and source-code path in this workflow uses `$REVIEW_DIR` instead of the main repo path. When spawning subagents, substitute the literal resolved path.

After setup, verify the worktree is healthy:

```bash
npx tsx "$REVIEW_DIR/src/cli/main.ts" bundles
```

If this fails, fall back to the main repo path and warn the user that the worktree could not be created.

---

## CLI Reference

All subcommands use `--flag=value` syntax. Same seed = same deal across calls. Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error. Run `<subcommand> --help` for detailed usage. **All commands run from `$REVIEW_DIR`.**

```bash
# Self-discovery — list all available bundles (JSON array)
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts bundles

# Inspect a bundle — atoms, depth, strategy coverage (JSON)
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts describe --bundle=nt-bundle

# List all coverage atoms for a bundle (JSON lines)
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts list --bundle=nt-bundle

# Per-atom evaluation — viewport only (no answer)
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=42

# Per-atom evaluation — submit bid, get full teaching feedback
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts eval --bundle=nt-bundle --atom=ATOM_ID --seed=42 --bid=2C

# Playthrough — get step count + first viewport
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42

# Playthrough — step through with grading (returns next viewport too)
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42 --step=0 --bid=2H

# Self-test — strategy bids against itself across all atoms
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --bundle=nt-bundle --seed=42
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --all --seed=42
```

**Do not hardcode bundle IDs.** Use `bundles` to discover available bundles at runtime. Use `describe --bundle=<id>` to get atom IDs for `eval`.

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

### Step 1: Discover Available Bundles

**First, use the CLI to discover what's available — do not rely on hardcoded bundle lists:**

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts bundles
```

This returns a JSON array of all registered bundles with `id`, `name`, `description`, `category`, and `atomCount`. Use this to determine scope.

**Ask the user what they want reviewed if they didn't specify.** Options:
- A specific bundle (e.g., `nt-bundle` for 1NT responses, Stayman, Jacoby Transfers)
- Everything (run for each bundle from the `bundles` output)

For a targeted review, use `describe` to inspect the bundle before proceeding:

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts describe --bundle=nt-bundle
```

This shows atom count, max BFS depth, strategy coverage percentage, and the full atom list with IDs.

### Step 2: Self-Test Baseline

Run the self-test first to get a quick pass/fail overview:

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --all --seed=42
```

Or for a single bundle:
```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --bundle=nt-bundle --seed=42
```

Parse the JSON output to get pass/fail/skip counts. This gives the orchestrator a quick health check before launching the two-phase evaluation pipeline.

### Step 3: Generate the Plan

Run the planner. The `--agents` flag sets a minimum — the plan **auto-scales upward** to keep per-agent work under the caps (`--max-atoms` for Phase 1, `--max-seeds-per-agent` for Phase 2):

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts plan --bundle=nt-bundle --agents=3 --coverage=2 --vuln=mixed --opponents=mixed
```

**Default opponent mode is `natural`** — opponents bid naturally (6+ HCP, 5+ suit) so interference is tested passively. Use `--opponents=none` only when you want controlled auctions with silent opponents.

**Scenario mixing:** `--vuln=mixed` assigns each seed a random vulnerability (uniform across None/NS/EW/Both). `--opponents=mixed` gives each seed a 50/50 chance of natural vs silent opponents. Both assignments are deterministic from the seed number. This tests diverse conditions without multiplying agent counts.

Optional tuning flags:
- `--max-atoms=8` — max atoms per Phase 1 agent (default 8; lower = more agents)
- `--max-seeds-per-agent=5` — max seeds per Phase 2 agent (default 5; lower = more agents)
- `--vuln=<none|ns|ew|both>` — fixed vulnerability for all seeds (instead of mixed)
- `--opponents=<natural|none>` — fixed opponent mode for all seeds (instead of mixed)

The plan output contains **two sections**, both with pre-computed, auto-scaled agent assignments:

- **`phase1`** — Per-atom list with BFS ordering, dependency graph, seeds, and expected bids. Each seed is an object: `{ seed, vulnerability, opponents }`. The full atom list is orchestrator-private. **`phase1.agents`** contains per-agent atom batches (atom IDs + seeds, **no expectedBid**) with subtree-preserving assignment and per-agent dependency subgraphs. Agents call `eval` themselves, passing the per-seed `--vuln` and `--opponents` flags.
- **`phase2`** — Playthrough seed assignments per agent, balanced by step count. Each seed carries its own `{ seed, vulnerability, opponents }`. Agents pass the per-seed flags to `play`.

When mixed mode is used, the output also includes `scenarioDistribution` showing how many seeds got each vulnerability/opponent combination.

Check the plan output for:
- **Coverage gaps** — atoms the planner couldn't cover (may need more seeds or indicate strategy gaps)
- **Uncovered atoms** — atoms with no valid seeds
- **Agent counts** — the plan may create more agents than `--agents` specified if needed to respect the per-agent caps
- **Scenario distribution** — verify seeds are spread across vulnerability states and opponent modes

---

## Phase 1: Per-Atom Targeted Evaluation (Parallel Agents)

Phase 1 distributes atoms across parallel agents. Each agent evaluates its batch of atoms independently, calling `eval` to get viewports and `eval --bid` to submit bids. The plan assigns atoms in **subtree-preserving batches** so parent-child atoms stay in the same agent, enabling local stop-on-error propagation without cross-agent coordination.

**The agent NEVER sees `expectedBid` or the full dependency tree.** Agents receive only atom IDs, seeds, and their dependency subgraph (for stop-on-error). The `eval` command itself enforces the information boundary — viewports never contain the correct answer.

### Step 4: Spawn Phase 1 Agents

Using `phase1.agents` from the plan, spawn parallel subagents with `run_subagent` (profile: `"subagent_general"`, `is_background: true`).

Each agent receives:
- Bundle ID
- Their atom batch: array of `{ atomId, seeds }` — **stripped of `expectedBid` and `stateId`**. Each seed is `{ seed, vulnerability, opponents }`.
- Their dependency subgraph (for stop-on-error)
- The Phase 1 evaluation protocol (below)

**Stripping orchestrator-private fields:** The plan's `phase1.agents[].atoms` includes `expectedBid` and `stateId`. Before building the agent prompt, strip these fields. Agents only need `atomId` and `seeds` (each seed with its `vulnerability` and `opponents`). The dependency subgraph uses state IDs internally but agents treat it as an opaque stop-on-error mechanism — they extract the `stateId` from the atom ID format (`<stateId>/<surfaceId>/<meaningId>`) only when checking the dependency graph.

#### How Many Agents to Spawn

The plan auto-scales agent counts. Spawn one subagent per entry in `phase1.agents` — do not hardcode agent counts. The plan ensures no agent gets more than `--max-atoms` atoms (default 8).

#### Phase 1 Agent Prompt Template

Each agent receives this prompt, customized with their bundle, atom batch, and dependency subgraph:

---

You are evaluating the **convention correctness** of a bridge bidding practice app by testing individual bidding decisions using its CLI. For each atom (a specific bidding decision point), you will see a hand and auction, decide the correct bid, then submit it to see if the app agrees. Each atom is tested with multiple seeds (different hands). **Do NOT invoke the browser skill or use Playwright.**

Use **bridgebum.com** as your authoritative reference for bridge conventions. When you need to verify a convention rule, look it up there with `webfetch`.

## Working Directory

```
{REVIEW_DIR}
```

## Your Assignment

- **Bundle:** {BUNDLE_ID}
- **Atoms:** {ATOM_COUNT} atoms, {TOTAL_EVAL_CALLS} total eval calls
- **Atom list:**

```json
{ATOM_LIST_JSON}
```

Each entry has `atomId` and `seeds` (an array of `{ seed, vulnerability, opponents }` objects). For every atom, evaluate **each seed** independently, using the seed's vulnerability and opponents values as CLI flags.

## Dependency Subgraph (Stop-on-Error)

```json
{DEPENDENCY_SUBGRAPH_JSON}
```

This maps state IDs to `{ depth, parentStateId, children }`. Extract the state ID from an atom ID by taking the first segment before the first `/`. When an atom's bid is **wrong and you believe the app is incorrect**, mark the atom's state and all descendant states as polluted. Skip all remaining atoms in polluted states.

## Evaluation Protocol

For each atom in your list, process all its seeds:

**1. Get the sanitized viewport:**
```bash
cd {REVIEW_DIR} && npx tsx src/cli/main.ts eval --bundle={BUNDLE_ID} --atom=<ATOM_ID> --seed=<N> --vuln=<VULN> --opponents=<OPP>
```

Use the `vulnerability` and `opponents` values from the seed object as `--vuln` and `--opponents` flags. Vulnerability values: `None`, `NS`, `EW`, `Both` (case-insensitive). Opponent values: `natural`, `none`.

The output contains ONLY what a human player would see: hand, hand evaluation (HCP, shape), auction so far, legal calls. No correct answer is included.

**2. Decide the correct bid.** Study the hand, HCP, shape, and auction. **Commit to your bid before proceeding.**

**3. Submit your bid:**
```bash
cd {REVIEW_DIR} && npx tsx src/cli/main.ts eval --bundle={BUNDLE_ID} --atom=<ATOM_ID> --seed=<N> --vuln=<VULN> --opponents=<OPP> --bid=<CALL>
```

Returns: `grade`, `correct`, `acceptable`, `yourBid`, `correctBid`, `feedback`, `teaching`.

**4. Evaluate the result:**
- **Agree with the app** → continue to next seed/atom.
- **Disagree with the app** → verify on bridgebum.com with `webfetch`, then record a finding citing the URL. Apply stop-on-error: mark descendant states as polluted, skip remaining atoms in those states.
- **`acceptable` or `correct-not-preferred`** → note it, continue.

**5. Repeat for each seed of this atom, then move to the next atom.**

## Rules

1. **Use bridgebum.com as your reference.** Look up conventions there when deciding bids. Cite the URL in any findings.
2. **CLI only.** Use `exec` to run CLI commands. **Do NOT use the browser skill or Playwright.**
3. **Stop-on-error propagation.** When the app's bid is wrong, skip all atoms in descendant states. Log which atoms were skipped and why.
4. **Commit before peeking.** Decide your answer BEFORE submitting. Do not revise based on later information.
5. **Test every seed.** Each atom has multiple seeds. Test all of them — different hands may expose different issues.

## Report Format

```
# Phase 1 Agent Report

## Summary
[PASS / FAIL / CONDITIONAL PASS]

## Atoms Evaluated
| Atom ID | Seeds Tested | Seeds Correct | Seeds Wrong | Polluted? |
|---------|-------------|---------------|-------------|-----------|

## Findings
### Finding N: [Title]
- Atom ID: [atom ID]
- Seed: [seed]
- Hand: [from viewport]
- Auction: [auction so far]
- My bid: [what agent decided]
- App bid: [from eval response]
- Why mine is correct: [bridge reasoning + reference URL]
- Severity: CRITICAL / MAJOR / MINOR

## Polluted Subtrees
| Root State | Cause (Atom ID) | Atoms Skipped |
|-----------|-----------------|---------------|

## Atoms Passed
[Atom IDs where all seeds matched]
```

---

### Step 5: Collect Phase 1 Results

Wait for all Phase 1 background agents to complete. Collect their structured reports.

### Step 6: Merge Phase 1 Agent Reports

Compile the following metrics across all Phase 1 agents:

| Metric | Description |
|--------|-------------|
| **Atoms tested** | Total atoms evaluated across all agents |
| **Atoms correct** | All seeds matched the app |
| **Atoms wrong** | Agent disagreed with the app on at least one seed |
| **Atoms polluted (skipped)** | Skipped due to upstream failure — list which upstream atom caused each skip |
| **Coverage gaps** | Atoms with no valid seeds (from plan output) |

Cross-agent findings:
- **Same atom found wrong by multiple agents** (if seeds are distributed) — boost confidence
- **Polluted subtrees** — aggregate across agents since subtrees are agent-local

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

Using `phase2.agents` from the plan, spawn parallel subagents with `run_subagent` (profile: `"subagent_general"`, `is_background: true`). **Phase 2 agents can be launched in parallel with Phase 1 agents** — they are independent. However, if you want Phase 1 findings to inform Phase 2 analysis, wait for Phase 1 to complete first and include findings in the Phase 2 agent prompts.

Each agent receives **ONLY**:
- Bundle ID
- Their assigned seed list (each seed: `{ seed, vulnerability, opponents }`)
- The playthrough protocol (below)

**NO state IDs, atom IDs, expected bids, or dependency tree information.**

The plan's `phase2.agents` section provides pre-balanced, auto-scaled seed assignments. Use them directly — spawn one subagent per entry. Each seed carries its own vulnerability and opponents values that the agent passes as CLI flags.

#### Playthrough Agent Prompt Template

Each agent receives this prompt, customized with their bundle and seed list:

---

You are evaluating the **convention correctness** of a bridge bidding practice app by playing through full auction sequences using its CLI. For each seed, you will step through a complete bidding sequence, deciding each bid, then submitting it to see if the app agrees. **Do NOT invoke the browser skill or use Playwright.**

Use **bridgebum.com** as your authoritative reference for bridge conventions. When you need to verify a convention rule, look it up there with `webfetch`.

## Working Directory

```
{REVIEW_DIR}
```

## Your Assignment

- **Bundle:** {BUNDLE_ID}
- **Seeds:** {SEED_LIST}

Each seed is an object: `{ seed, vulnerability, opponents }`. For each seed, pass the vulnerability and opponents as `--vuln` and `--opponents` flags to all CLI commands. Follow the playthrough protocol below. You are testing whether the app's bidding recommendations form a coherent, correct auction sequence.

## Playthrough Protocol

For each assigned seed:

**1. Get the step count + first viewport:**
```bash
cd {REVIEW_DIR} && npx tsx src/cli/main.ts play --bundle={BUNDLE_ID} --seed=<N> --vuln=<VULN> --opponents=<OPP>
```
Returns `totalSteps` and the first step's viewport.

**2. For each step (0 to totalSteps-1):**

Study the viewport (hand, HCP, auction, legal calls). **Commit to your bid before proceeding.**

Submit your bid:
```bash
cd {REVIEW_DIR} && npx tsx src/cli/main.ts play --bundle={BUNDLE_ID} --seed=<N> --vuln=<VULN> --opponents=<OPP> --step=<i> --bid=<CALL>
```

Returns: `grade`, `correct`, `correctBid`, `feedback`, `teaching`, `nextStep`, `complete`.

**3. Evaluate the result:**
- **Agree with the app** → use `nextStep` viewport, continue.
- **Disagree with the app** → verify on bridgebum.com with `webfetch`, then record a finding citing the URL. **Stop this playthrough** — subsequent steps are in a polluted auction context. Move to the next seed.
- **You were wrong and accept the app is correct** → use `nextStep` viewport, continue.

**4. Repeat until `complete: true`, then move to the next seed.**

## Rules

1. **Use bridgebum.com as your reference.** Look up conventions there when deciding bids. Cite the URL in any findings.
2. **CLI only.** Use `exec` to run CLI commands. **Do NOT use the browser skill or Playwright.**
3. **Stop on first real error per playthrough.** If the app's bid is wrong at step N, do not evaluate steps N+1, N+2, etc. Record the finding and move to the next seed.
4. **Commit before peeking.** Decide your answer BEFORE submitting. Do not revise based on later information.

## Phase 1 Findings

The Phase 1 agents found these issues during per-atom targeted evaluation. Focus your analysis on these areas:

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

Collect Phase 1 agent reports and Phase 2 agent reports (all from background subagents). Wait for all background agents to complete before proceeding.

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

The plan's `phase1` section contains orchestrator-private data including `expectedBid` for every atom and the full dependency graph. Seeds are objects: `{ seed, vulnerability, opponents }`. The `phase1.agents` section provides pre-stripped agent assignments, but agents must still NOT receive the `expectedBid` or `stateId` fields from their atom lists. The orchestrator uses the full plan to:
1. Build agent prompts with stripped atom lists (only `atomId` + `seeds` with per-seed scenario)
2. Include per-agent dependency subgraphs for stop-on-error
3. Map agent findings back to specific atoms for the aggregated report

The agents call `eval` themselves but the information boundary is preserved: `eval` without `--bid` never exposes the correct answer, and `eval --bid` only reveals it after the agent has committed.

### Source Code Locations

All paths are relative to `$REVIEW_DIR`:

- **Convention specs:** `src/conventions/definitions/<bundle>/convention-spec.ts`
- **Convention modules:** `src/conventions/definitions/<bundle>/modules/`
- **Viewport boundary:** `src/core/viewport/build-viewport.ts`
- **Teaching resolution:** `src/teaching/teaching-resolution.ts`
- **Strategy adapter:** `src/strategy/bidding/protocol-adapter.ts`

---

## Worktree Cleanup

**After the review is complete** (all agents finished, report compiled), remove the disposable worktree:

```bash
git -C /home/joshua-fu/projects/bridge-convention-app worktree remove "$REVIEW_DIR" --force
```

If cleanup fails (e.g., a subagent still has a file open), log a warning and tell the user to run the command manually. The worktree is in `/tmp` so it will also be cleaned up on reboot.
