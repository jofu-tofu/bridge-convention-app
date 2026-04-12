# CompileFeedback Workflow

> **Trigger:** "compile bridge feedback", "summarize review results", "prioritize bridge issues"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md`

## Purpose

Merge completeness-audit notes, `selftest` output, playthrough output, and deep-dive agent reports into one actionable report.

## Workflow Steps

### Step 1: Parse Structured Inputs

Read:

- Tier 0 audit notes
- `selftest` JSON
- `play` / `play --bid` / `play --bids` JSON
- agent reports

Extract:

- bundle
- module
- system
- seed
- user bid sequence
- grade
- reference URL
- missing surface / wrong requirement / teaching issue classification

### Step 2: Separate Finding Types

Keep these buckets separate:

1. Missing surfaces
2. Wrong requirements
3. Runtime convention logic errors
4. Teaching-feedback errors
5. Selftest skips
6. Observations

Do not mix a missing surface with a runtime grading error just because they share a bundle.

### Step 3: Deduplicate by Root Cause

If multiple seeds point to the same wrong surface or same missing continuation, collapse them into one finding and keep the strongest evidence set.

### Step 4: Rank Severity

- Wrong recommendation or missing common teaching branch: `CRITICAL`
- Wrong requirement or misleading teaching explanation: `MAJOR`
- Terminology or minor presentation issue: `MINOR`
- Worth noting, but not wrong: `OBSERVATION`

### Step 5: Produce the Report

Use this shape:

```text
# Bridge Expert Review — Compiled Report

## Scope
[bundles, modules, systems]

## Metrics
- Selftest pass rate:
- Selftest skips:
- Playthrough pass rate:
- Missing surfaces:
- Wrong requirements:

## Critical Findings
[ordered by root cause]

## Major Findings
[ordered by root cause]

## Missing Surfaces
[group by module]

## Selftest Skips
[informational]

## Recommended Fix Order
1. ...
2. ...
3. ...
```

### Step 6: Suggest the Next Loop

Recommend the smallest rerun that verifies the likely fixes, usually:

```bash
npx tsx src/cli/main.ts selftest --bundle=<id> --seed=42 --count=20 --system=<id>
```
