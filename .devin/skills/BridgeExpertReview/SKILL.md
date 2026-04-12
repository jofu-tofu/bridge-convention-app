---
name: BridgeExpertReview
description: CLI-first adversarial evaluation of a bridge app. Runs headless coverage-runner for comprehensive convention correctness testing, then spawns CLI evaluation agents for deep-dive analysis. All agents use exec and read tools — never the browser skill. Zero tolerance for inaccuracy. USE WHEN bridge expert review OR evaluate bridge app OR bridge UX audit OR adversarial bridge testing OR bridge correctness review OR expert bridge evaluation OR bridge app QA.
---

# BridgeExpertReview

Two-tier adversarial evaluation of the bridge practice app. **Tier 1 (CLI)** runs the headless coverage-runner to enumerate all coverage atoms and analyzes convention correctness via source code. **Tier 2 (CLI Agents)** spawns specialist subagents that use the CLI and source code to deep-dive into convention logic, teaching content, and coverage completeness. Both Phase 1 (per-atom evaluation) and Phase 2 (playthrough evaluation) are parallelized across agents using the plan command's pre-computed agent assignments. The orchestrator decides how many agents to spawn based on the review scope. All agents use `exec` and `read` tools — **never the browser skill or Playwright**. A single inaccuracy is treated as a site-credibility failure.

The entire review runs in a **disposable git worktree** (`/tmp/bridge-expert-review-*`) so the main working tree stays free for development. The worktree is cleaned up automatically when the review completes.

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
-> Step 0: Creates a disposable git worktree in /tmp, installs deps
-> Tier 1: Discovers bundles via `bundles`, runs `selftest --all --seed=42` for baseline
-> Generates plan with `plan --agents=N --coverage=2 --vuln=mixed --opponents=mixed` for Phase 1 atom batches and Phase 2 seed lists (each seed carries its own vulnerability and opponents)
-> Phase 1: Spawns parallel agents, each evaluating their batch of atoms (each atom × 2 seeds) via `eval`
-> Phase 2: Spawns parallel agents for playthrough evaluation via `play`
-> Compiles all findings into prioritized feedback with severity, evidence, and references
-> Cleans up the worktree
```

**Example 2: Compile existing feedback**
```
User: "Compile the bridge review feedback"
-> Invokes CompileFeedback workflow
-> Reads `eval --bid` JSON responses + CLI agent reports
-> Deduplicates, cross-references, and severity-ranks all findings
-> Produces a single prioritized action list with CLI metrics
```

**Example 3: Targeted convention review**
```
User: "Run a bridge expert review focused on Stayman"
-> Invokes RunReview workflow with focus hint
-> Tier 1: Runs `bundles` to discover available bundles, then `describe --bundle=nt-bundle` to inspect atoms
-> For each Stayman-related atom: `eval` -> decide bid -> `eval --bid` -> retry if wrong
-> Tier 2: CLI agents deep-dive into nt-bundle with `eval`/`play` loops
-> Reports correctness issues with state/surface IDs for precise reproducibility
```
