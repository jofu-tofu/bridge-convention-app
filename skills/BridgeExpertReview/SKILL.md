---
name: BridgeExpertReview
description: Project-local adversarial evaluation of bridge convention behavior. Tier 0 audits module fixture surfaces against authoritative references. Tier 1 runs CLI selftest and session playthrough baselines. Tier 2 spawns CLI-only deep-dive agents for convention logic and teaching review. USE WHEN bridge expert review OR evaluate bridge app OR bridge correctness review OR adversarial bridge testing OR expert bridge evaluation OR bridge app QA.
---

# BridgeExpertReview

Project-local review workflow for this bridge app. The skill stays inside the repo because it depends on this project's Rust fixtures, CLI shape, and teaching pipeline. It uses three tiers: fixture/reference completeness audit, CLI baseline runs, and CLI-only deep-dive agents. Browser automation is out of scope.

> **For agents modifying this skill:** Read `SkillIntent.md` before making changes.

**Before executing any workflow below, read `Standards/EvaluationFramework.md`.** All evidence rules, severity rules, and CLI conventions are defined there.

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

**Example 1: Full project review**
```
User: "Run a bridge expert review of the app"
-> Invokes RunReview workflow
-> Creates a disposable worktree
-> Audits module fixtures against their authority references
-> Runs selftest for the requested bundles and systems
-> Spawns CLI-only agents to walk playthrough seeds with `play` and `play --bids`
-> Compiles the findings into one prioritized report
```

**Example 2: Targeted bundle review**
```
User: "Run a bridge expert review focused on Stayman"
-> Invokes RunReview workflow with nt-bundle/stayman focus
-> Reads the stayman fixture and authority URL
-> Runs focused selftest and seed playthroughs
-> Reports missing surfaces, wrong requirements, and runtime teaching issues
```

**Example 3: Compile existing findings**
```
User: "Compile the bridge review feedback"
-> Invokes CompileFeedback workflow
-> Reads selftest JSON, playthrough JSON, audit notes, and agent reports
-> Deduplicates by convention/root cause
-> Produces a single fix-priority report
```
