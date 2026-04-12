# Build Workflow

> **Trigger:** "add convention", "build convention", "new convention", "scaffold convention", "fill convention gaps"

## Reference Material

- **SkillIntent:** `../SkillIntent.md`
- **Rust workspace context:** `/home/joshua-fu/projects/bridge-convention-app/crates/CLAUDE.md`
- **Convention authoring guide:** `/home/joshua-fu/projects/bridge-convention-app/docs/guides/convention-authoring.md`

## Purpose

Author a new convention module or extend an existing one using this repo's fixture-driven convention system.

## Workflow Steps

### Step 0: Identify Scope

Use the current CLI to determine whether this is a new module or an extension:

```bash
npx tsx src/cli/main.ts modules
npx tsx src/cli/main.ts bundles
```

### Step 1: Choose the Authority

For an existing module, read its fixture first:

```bash
sed -n '1,120p' crates/bridge-conventions/fixtures/modules/{module-id}.json
```

Use:

- `references.authority` as the rules source of truth
- `references.discovery` as the overview source

For a new module, choose the authority first and record both URLs in the new fixture.

### Step 2: Compare the Existing Fixture to the Reference

For gap-fill work, inspect `states[].surfaces[]` in the fixture and compare them to the authority reference sequence by sequence.

Classify each sequence as:

- present
- missing
- wrong requirements
- intentionally out of scope

### Step 3: Author the Fixture Changes

Work in:

- `crates/bridge-conventions/fixtures/modules/{module-id}.json`
- bundle fixture files under `crates/bridge-conventions/fixtures/`
- `crates/bridge-conventions/fixtures/bundle-manifests.json` when bundle wiring changes

Follow the existing fixture patterns for:

- `states`
- `surfaces`
- `references`
- `teaching`
- explanation entries

### Step 4: Validate

Run the narrowest useful verification:

```bash
cargo test --workspace
npx tsx src/cli/main.ts selftest --bundle={bundle-id} --seed=42 --count=20 --system=sayc
```

If app-side TS or docs were touched, also run:

```bash
npm run lint
```

### Step 5: Report

Summarize:

- authority used
- surfaces added or changed
- remaining known gaps
- validation commands and outcomes
