---
name: BridgeExpertReview
description: CLI-first adversarial evaluation of a bridge app with browser UI spot-checks. Runs headless coverage-runner for comprehensive convention correctness testing, then uses browser agents for UI rendering validation. Zero tolerance for inaccuracy. USE WHEN bridge expert review OR evaluate bridge app OR bridge UX audit OR adversarial bridge testing OR bridge correctness review OR expert bridge evaluation OR bridge app QA.
---

# BridgeExpertReview

Two-tier adversarial evaluation of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to test every (state, surface) pair for convention correctness — fast, comprehensive, deterministic. **Tier 2 (Browser)** spawns specialist subagents to validate UI rendering: suit symbols, layout, alerts, and teaching feedback display. A single inaccuracy is treated as a site-credibility failure.

> **For agents modifying this skill:** Read `SkillIntent.md` before making changes.

**Before executing any workflow below, read `Standards/EvaluationFramework.md`.** All evaluation criteria and agent personas are defined there.

## Workflow Routing

When a workflow is matched, **read its file and follow the steps within it.**

**When running a review, output this notification:**

```
Running the **[WorkflowName]** workflow from the **BridgeExpertReview** skill...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **RunReview** | "run bridge review", "evaluate bridge app", "bridge expert review", "adversarial bridge test" | `Workflows/RunReview.md` |
| **CompileFeedback** | "compile bridge feedback", "summarize review results", "prioritize bridge issues" | `Workflows/CompileFeedback.md` |

## Examples

**Example 1: Full adversarial review**
```
User: "Run a bridge expert review of the app"
-> Invokes RunReview workflow
-> Tier 1: Runs `npx tsx src/cli/coverage-runner.ts --all --json` for full coverage
-> Parses JSON: identifies failures, infeasible pairs, first-attempt vs post-feedback accuracy
-> Tier 2: Spawns browser agents for UI spot-checks (suit symbols, alert rendering, layout)
-> Compiles all findings into prioritized feedback with severity, evidence, and references
```

**Example 2: Compile existing feedback**
```
User: "Compile the bridge review feedback"
-> Invokes CompileFeedback workflow
-> Reads CLI JSON output + browser agent reports
-> Deduplicates, cross-references, and severity-ranks all findings
-> Produces a single prioritized action list with CLI metrics
```

**Example 3: Targeted convention review**
```
User: "Run a bridge expert review focused on Stayman"
-> Invokes RunReview workflow with focus hint
-> Tier 1: Runs `npx tsx src/cli/coverage-runner.ts --bundle=nt-bundle --json`
-> Parses JSON for all Stayman-related (state, surface) pairs
-> Tier 2: Browser agents spot-check Stayman UI at ?coverage=true&convention=nt-bundle
-> Reports correctness issues with state/surface IDs for precise reproducibility
```
