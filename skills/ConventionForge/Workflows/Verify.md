# Verify Workflow

> **Trigger:** "verify convention", "check convention", "audit convention", "convention correctness", "validate convention"

## Reference Material

- **SkillIntent:** `../SkillIntent.md`
- **BridgeExpertReview:** `../../BridgeExpertReview/SKILL.md`
- **Convention authoring guide:** `/home/joshua-fu/projects/bridge-convention-app/docs/guides/convention-authoring.md`

## Purpose

Verify that a convention fixture is both complete against its authority reference and sound at runtime inside this repo.

## Workflow Steps

### Step 0: Resolve the Target

Use the CLI to find the right bundle and module:

```bash
npx tsx src/cli/main.ts bundles
npx tsx src/cli/main.ts modules
npx tsx src/cli/main.ts describe --bundle={bundle-id}
```

### Step 0.5: Structural Invariants

Always run the structural-invariants suite before anything else; it catches fixture shape regressions quickly. Use `--test` so cargo selects the test binary by file name — a bare filter `structural_invariants` matches no test names and silently runs zero tests:

```bash
cargo test -p bridge-conventions --test structural_invariants
```

### Step 1: Phase 1 — Fixture vs Authority Snapshot

Read the target module fixture:

```bash
sed -n '1,220p' crates/bridge-conventions/fixtures/modules/{module-id}.json
```

Then perform the comparison **in this order**:

1. **Read `scopeNote` FIRST.** The fixture's top-level `scopeNote` names what the author deliberately excluded (e.g. "Stops at the 4-level. Ogust continuations not supported. Smolen is handled in a separate module."). Treat every exclusion as a standing instruction for this Verify pass: do NOT flag missing surfaces, missing continuations, or missing variants that `scopeNote` explicitly excludes. If an exclusion looks wrong against the authority — e.g. the authority treats it as essential — surface it under **scope-note review**, not as a missing-surface finding.

2. **Compare against the frozen snapshot, not a live fetch.**

   - Use `references.authority.snapshot.text` as the ground truth. This is the authority prose captured at fixture-Build time. It is the same text the fixture was authored against, so findings are deterministic across sessions.
   - Do NOT fetch `references.authority.url` during Verify. Re-fetching was the main cause of spurious "new findings" across sessions — site copy drifts, and repeat reads of the same page surface different details. The URL is informational only.
   - If you believe the snapshot itself is wrong or missing a section that matters for this review, flag that as a **snapshot review** item and stop. Do not paper over it by re-fetching.

3. **Note snapshot freshness, but don't escalate it.** Check `references.authority.snapshot.fetchedAt`. If it is older than ~180 days, add a single line to the report: "snapshot is stale (fetched YYYY-MM-DD); consider refreshing in the next Build pass." Do **not** convert staleness into per-surface findings.

4. `references.discovery.url` remains a secondary overview reference — you may cite it for orientation, but the snapshot is the comparison target.

5. Compare the snapshot sequences to `states[].surfaces[]`.

Report:

- missing surfaces (excluding anything covered by `scopeNote`)
- wrong requirements
- dead zones
- out-of-scope continuations in the fixture that `scopeNote` does not document
- scope-note review items (exclusions that look wrong against the authority)
- snapshot review items (if the snapshot itself needs refreshing)
- snapshot staleness note, if any

### Step 2: Phase 2 — Runtime Review

If the user wants runtime validation beyond the fixture comparison, invoke `BridgeExpertReview` scoped to the relevant bundle or module.

Use it when you need:

- `selftest` baselines
- targeted `play` / `play --bids` seed walks
- teaching-feedback review

### Step 3: Produce the Combined Verdict

Keep the output split into:

1. fixture completeness findings (filtered against `scopeNote`)
2. runtime correctness findings
3. scope-note / snapshot review items
4. recommended fix order
