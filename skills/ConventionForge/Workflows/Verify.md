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

### Step 1: Phase 1 — Fixture vs Authority

Read the target module fixture:

```bash
sed -n '1,220p' crates/bridge-conventions/fixtures/modules/{module-id}.json
```

Then:

1. fetch `references.authority.url`
2. fetch `references.discovery.url`
3. compare the authority sequences to `states[].surfaces[]`

Report:

- missing surfaces
- wrong requirements
- dead zones
- out-of-scope continuations

### Step 2: Phase 2 — Runtime Review

If the user wants runtime validation beyond the fixture comparison, invoke `BridgeExpertReview` scoped to the relevant bundle or module.

Use it when you need:

- `selftest` baselines
- targeted `play` / `play --bids` seed walks
- teaching-feedback review

### Step 3: Produce the Combined Verdict

Keep the output split into:

1. fixture completeness findings
2. runtime correctness findings
3. recommended fix order
