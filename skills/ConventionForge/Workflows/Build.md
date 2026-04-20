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

### Step 2: Capture the Authority Snapshot and Write the Scope Note

Do this **before authoring any surfaces**. Both fields are required; the structural-invariants test (`cargo test -p bridge-conventions --test structural_invariants`) fails loudly if either is missing or empty.

1. **Fetch the authority URL** and save the prose into `references.authority.snapshot.text`. Capture the full text of the relevant sections (you do not need ads, nav, or footer). This snapshot becomes the immutable ground truth Verify sessions compare against — Verify does NOT re-fetch, so what you capture here is what future reviews see.

2. **Stamp `references.authority.snapshot.fetchedAt`** with today's date in ISO-8601 `YYYY-MM-DD`.

3. **Write `scopeNote`** at the top level of the fixture (sibling of `moduleId`, `description`, `purpose`, `references`, etc.). It is free text, 1–4 sentences, naming what the module intentionally does **not** cover. Examples:

   - `"Stops at the 4-level. Ogust continuations not supported. Smolen is handled in a separate module."`
   - `"Standard Bergen only — reverse Bergen (swapped 3C/3D meanings) is out of scope."`
   - `"Direct seat only; balancing-seat overcalls are not modeled."`

   Treat `scopeNote` as part of the authority contract: if Verify later flags something you listed here as "missing," that finding is not actionable — the fixture is correct by design. If authority coverage looks essential and you still choose to exclude it, say why in the note.

Fixture shape (top-level sibling fields):

```jsonc
{
  "moduleId": "...",
  "displayName": "...",
  "scopeNote": "One-to-four-sentence description of what is intentionally out of scope.",
  "references": {
    "authority": {
      "url": "https://...",
      "label": "...",
      "snapshot": {
        "text": "<captured authority prose>",
        "fetchedAt": "YYYY-MM-DD"
      }
    },
    "discovery": {
      "url": "https://www.bridgebum.com/..."
    }
  }
  // description, purpose, teaching, reference, states, ...
}
```

### Step 3: Compare the Existing Fixture to the Reference

For gap-fill work, inspect `states[].surfaces[]` in the fixture and compare them to the authority snapshot sequence by sequence.

Classify each sequence as:

- present
- missing
- wrong requirements
- intentionally out of scope — **and add it to `scopeNote` if not already listed**

If you find a new intentional exclusion while authoring, extend `scopeNote` in the same change. The note is the machine-readable record of scope; leaving it stale re-introduces the spurious-findings problem on the next Verify pass.

### Step 4: Author the Fixture Changes

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

#### `ModuleReference` authoring shape (shrunken canonical form)

The `reference` block is intentionally small: most fields are derived at viewport-build time. Author only these fields:

```jsonc
"reference": {
  "summaryCard": {
    "trigger": "Partner opens 1NT, you respond",
    "definingMeaningId": "stayman:ask",
    "partnership": "Confirm both-major treatment before using."
    // bid / promises / denies are DERIVED from definingMeaningId;
    // guidingIdea defaults to teaching.principle if omitted.
  },
  "workedAuctions": [ /* label + calls[{seat, call, rationale, meaningId?}] + outcomeNote */ ],
  "interference": {
    // Tagged union — empty items is illegal.
    "status": "applicable",
    "items": [{ "opponentAction": "...", "ourAction": "...", "note": "..." }]
    // OR: { "status": "notApplicable", "reason": "..." }
  },
  "quickReference": {
    // Tagged union — no null-escape.
    "kind": "grid",
    "rowAxis": { "kind": "systemFactLadder", "label": "...", "facts": ["system...", ...] },
    "colAxis": { "kind": "qualitative",     "label": "...", "values": ["...", "..."] },
    "cells": [["...", "..."], ["...", "..."]]
    // OR: { "kind": "list", "axis": {...}, "items": [{"recommendation": "...", "note": ""}] }
  },
  "relatedLinks": [{ "moduleId": "...", "discriminator": "..." }]
}
```

**Derivation rules (do NOT duplicate in `reference`):**

- `whenNotToUse` is derived from `teaching.commonMistakes` (entries are `{ text, reason }`, >=3 required). Author what-not-to-do in the teaching block; never re-author into `reference`.
- `summaryCard.bid` / `promises` / `denies` render from the defining meaning's `encoding.default_call` and public fact clauses via `describe_system_fact_value`.
- `responseTable` columns are auto-discovered from fact IDs in the module's surfaces. Fixed columns are only `Response | Meaning`. There are no `responseTableOverrides`, no `systemCompat`, no `decisionGrid` — all three are retired.

**Authoring smells to avoid:**

- Duplicating `teaching.commonMistakes` into `reference.whenNotToUse` — the single source is `teaching`.
- Naming systems (SAYC / 2-1 / Acol / Precision) in authored prose — per-system rendering comes from the active `SystemConfig` via the `systemFactLadder -> describe_system_fact_value -> SystemConfig` chain.
- Numeric HCP in authored prose outside worked-auction rationales — let the ladder derive threshold labels.
- Empty `interference.items` — use the `notApplicable` status with a reason instead.

### Step 5: Validate

Run the narrowest useful verification:

```bash
cargo test --workspace
cargo test -p bridge-conventions --test structural_invariants
npx tsx src/cli/main.ts selftest --bundle={bundle-id} --seed=42 --count=20 --system=sayc
```

If app-side TS or docs were touched, also run:

```bash
npm run lint
```

### Step 6: Report

Summarize:

- authority used (URL + snapshot date)
- `scopeNote` contents (so reviewers see what was intentionally excluded)
- surfaces added or changed
- remaining known gaps
- validation commands and outcomes
