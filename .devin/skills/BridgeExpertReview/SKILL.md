---
name: BridgeExpertReview
description: CLI-first adversarial evaluation of a bridge app. Runs headless coverage-runner for comprehensive convention correctness testing, then spawns CLI evaluation agents for deep-dive analysis. All agents use exec and read tools — never the browser skill. Zero tolerance for inaccuracy. USE WHEN bridge expert review OR evaluate bridge app OR bridge UX audit OR adversarial bridge testing OR bridge correctness review OR expert bridge evaluation OR bridge app QA.
---

# BridgeExpertReview

Two-tier adversarial evaluation of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to enumerate all coverage atoms and analyzes convention correctness via source code. **Tier 2 (CLI Agents)** spawns specialist subagents that use the CLI and source code to deep-dive into convention logic, teaching content, and coverage completeness. The orchestrator decides how many agents to spawn based on the review scope. All agents use `exec` and `read` tools — **never the browser skill or Playwright**. A single inaccuracy is treated as a site-credibility failure.

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
-> Tier 1: Runs `selftest --all --seed=42` for baseline, then `list`/`present`/`grade` per target
-> For each failure: records viewport (from `present`), feedback (from `grade`), verifies against bridge sources
-> Tier 2: Spawns CLI agents based on scope (e.g., one per convention, or by concern area)
-> CLI agents use `exec` to run coverage-runner `present`/`grade` + `read` to analyze source code
-> Compiles all findings into prioritized feedback with severity, evidence, and references
```

**Example 2: Compile existing feedback**
```
User: "Compile the bridge review feedback"
-> Invokes CompileFeedback workflow
-> Reads `grade` JSON responses + CLI agent reports
-> Deduplicates, cross-references, and severity-ranks all findings
-> Produces a single prioritized action list with CLI metrics
```

**Example 3: Targeted convention review**
```
User: "Run a bridge expert review focused on Stayman"
-> Invokes RunReview workflow with focus hint
-> Tier 1: Runs `npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle` to enumerate targets
-> For each Stayman-related atom: `present` -> decide bid -> `grade` -> retry if wrong
-> Tier 2: CLI agents deep-dive into nt-bundle with `present`/`grade` loops
-> Reports correctness issues with state/surface IDs for precise reproducibility
```
