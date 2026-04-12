# RunReview Workflow

> **Trigger:** "run bridge review", "evaluate bridge app", "bridge expert review", "adversarial bridge test"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md`
- **SkillIntent:** `../SkillIntent.md`
- **CLI context:** `/home/joshua-fu/projects/bridge-convention-app/src/cli/CLAUDE.md`
- **Rust workspace context:** `/home/joshua-fu/projects/bridge-convention-app/crates/CLAUDE.md`

## Purpose

Run a repo-specific bridge correctness review using fixture audit plus CLI runtime checks. The workflow is intentionally read-only.

## Workflow Steps

### Step 0: Create a Disposable Worktree

```bash
REVIEW_DIR="/tmp/bridge-expert-review-$$"
git -C /home/joshua-fu/projects/bridge-convention-app worktree add --detach "$REVIEW_DIR" HEAD
cd "$REVIEW_DIR" && npm ci --ignore-scripts
```

If `npm ci --ignore-scripts` was used, run the normal local prerequisites explicitly when needed:

```bash
cd "$REVIEW_DIR" && npm run wasm:ensure
```

### Step 1: Discover Scope

Start from the real CLI:

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts bundles
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts modules
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts describe --bundle=nt-bundle
```

If the user did not specify scope, ask whether they want:

- one bundle
- one module within a bundle
- all bundles

Supported systems are the static CLI values `sayc`, `two-over-one`, and `acol`.

### Step 2: Tier 0 Completeness Audit

For each module in scope:

1. Read `crates/bridge-conventions/fixtures/modules/{module-id}.json`.
2. Extract:
   - `references.authority`
   - `references.discovery`
   - `states[].surfaces[]`
3. Fetch the authority URL first, then the discovery URL.
4. Compare the reference sequences to authored surfaces.

For broad scopes, spawn one audit agent per module. Each agent should report:

- missing sequences
- wrong requirements
- dead zones
- out-of-scope advanced treatments

### Step 3: Tier 1 Selftest Baseline

Run `selftest` for the requested bundles and systems:

```bash
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --bundle=nt-bundle --seed=42 --count=20 --system=sayc
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --bundle=nt-bundle --seed=42 --count=20 --system=two-over-one
cd "$REVIEW_DIR" && npx tsx src/cli/main.ts selftest --bundle=nt-bundle --seed=42 --count=20 --system=acol
```

For full-project review, repeat across all bundles from `bundles`.

Capture pass, fail, and skip counts. Failures should drive which bundles get the heaviest deep-dive seed coverage.

### Step 4: Tier 2 Playthrough Review

Split the requested seed range across review agents. Each agent should use this runtime loop:

1. Get the first user decision:
   ```bash
   cd "$REVIEW_DIR" && npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42 --system=sayc
   ```
2. Decide the correct user bid from the viewport.
3. Submit it:
   ```bash
   cd "$REVIEW_DIR" && npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42 --system=sayc --bid=2C
   ```
4. If a later user decision is needed, replay prior user bids only:
   ```bash
   cd "$REVIEW_DIR" && npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42 --system=sayc --bids=2C,3NT
   ```

Agents should record:

- seed
- system
- user bid sequence
- grade
- feedback / teaching mismatch
- authority citation for any disagreement

### Step 5: Compile and Clean Up

Hand Tier 0 notes, `selftest` JSON, playthrough JSON, and agent reports to `CompileFeedback`.

When the review is complete:

```bash
git -C /home/joshua-fu/projects/bridge-convention-app worktree remove "$REVIEW_DIR" --force
```
