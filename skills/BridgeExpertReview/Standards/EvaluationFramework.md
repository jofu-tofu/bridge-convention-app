# Evaluation Framework

> Repo-specific review rules for `BridgeExpertReview`.

## Review Tiers

### Tier 0: Fixture Completeness Audit

Use the module fixture JSON as the app-side source of truth:

- `crates/bridge-conventions/fixtures/modules/{module-id}.json`
- `references.authority.url` for the authoritative rule source
- `references.discovery.url` for BridgeBum overview/discovery
- `states[].surfaces[]` for authored meanings, calls, and clauses

This tier answers:

- Is a reference sequence missing entirely?
- Does an existing surface have the wrong HCP, length, or shape requirements?
- Does the fixture leave obvious dead zones?

### Tier 1: CLI Baseline

Use the real CLI surface from `src/cli/main.ts`:

- `bundles`
- `modules`
- `describe --bundle=<id>`
- `selftest --bundle=<id> [--seed=N] [--count=N] [--system=<id>]`
- `selftest --all [--seed=N] [--count=N] [--system=<id>]`
- `play --bundle=<id> --seed=N [...]`
- `play --bundle=<id> --seed=N --bid=<call> [...]`
- `play --bundle=<id> --seed=N --bids=<c1,c2,...> [...]`

Supported systems are static CLI flags, not a discovery command: `sayc`, `two-over-one`, `acol`.

### Tier 2: CLI Deep-Dive Agents

Spawn agents that:

- read fixture JSON and source files
- fetch authority references
- walk seed ranges with `play`
- replay later user decisions with `play --bids`

No browser tooling or screenshot assertions belong here.

## Metrics

| Metric | Meaning |
|--------|---------|
| Selftest pass rate | `pass / (pass + fail)` from `selftest` output |
| Selftest skip count | Seeds where no strategy recommendation was available |
| Playthrough pass rate | Seeds where every reviewed user decision graded acceptable or better |
| Missing surface count | Reference sequences with no authored matching surface |
| Wrong-requirement count | Authored surfaces whose requirements diverge from the authority |
| Teaching issue count | Correctness or clarity problems in `feedback` / `teaching` output |

## Evidence Rules

Every finding should include:

1. The bundle and module in scope.
2. The seed and system if runtime evidence is involved.
3. The relevant fixture surface or missing sequence.
4. The fetched reference URL.
5. A concrete quote or paraphrase of the app behavior.

## Severity

| Severity | Meaning |
|----------|---------|
| CRITICAL | Wrong bid recommendation, missing common surface, or factually wrong bridge teaching |
| MAJOR | Wrong requirements, misleading teaching text, or serious convention gap on a less common branch |
| MINOR | Terminology, labeling, or presentational issues that do not change the taught bridge action |
| OBSERVATION | Worth noting, but not a correctness failure |

## Review Lenses

### Completeness Lens

Check fixture coverage against the authority reference. Prioritize R1/R2 paths first, then later continuations.

### Convention Logic Lens

Use `play` results and source inspection to verify the recommended bid matches standard bridge practice for the scoped system.

### Teaching Lens

Check `feedback` and `teaching` output for factual accuracy, not just tone. If the app teaches the wrong reason, that is still a correctness failure.

## Sources

Priority order:

1. The module fixture's `references.authority`
2. The fixture's `references.discovery`
3. Secondary references only when the authority is silent on a continuation

Never cite "common bridge knowledge" without an actual fetched source.
