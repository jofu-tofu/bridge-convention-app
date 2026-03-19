# CompileFeedback Workflow

> **Trigger:** "compile bridge feedback", "summarize review results", "prioritize bridge issues"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md`

## Purpose

Take CLI coverage-runner JSON output (`grade`, `selftest`) and CLI agent evaluation reports and compile them into a single, deduplicated, prioritized action list with quantitative metrics.

## Input Sources

| Source | Type | Contains |
|--------|------|----------|
| **CLI `grade` JSON** | Structured JSON | Per-target responses: `yourBid`, `correctBid`, `grade`, `correct`, `requiresRetry`, `feedback` |
| **CLI `selftest` JSON** | Structured JSON | Aggregate pass/fail/skip counts and per-atom results |
| **CLI agent reports** | Structured text | Deep-dive convention logic findings, teaching content issues, coverage completeness analysis |

## Workflow Steps

### Step 1: Parse CLI JSON Results

Read the CLI `grade` and `selftest` JSON responses. Extract:

1. **Aggregate metrics:**
   - Total targets tested (from `selftest` totalAtoms)
   - First-attempt accuracy (% where `grade` returned `correct: true` on first try)
   - Post-feedback accuracy (% correct after reading feedback and retrying)
   - Selftest pass rate (pass / totalAtoms)
   - Failure count by severity

2. **Per-failure details:**
   - Bundle, target (state), surface
   - Hand and auction from `present` output
   - `correctBid` vs `yourBid` from `grade` response
   - `feedback` text
   - `grade` value (correct or wrong)

3. **Selftest skips** — atoms where the strategy returned null. Log them but do not flag as errors.

### Step 2: Collect CLI Agent Reports

Gather evaluation reports from all spawned CLI agents. Each report follows the structured format from `RunReview.md` Step 8.

### Step 3: Merge and Deduplicate

Compare findings across orchestrator results and all CLI agents:

- **Orchestrator finding + agent confirmation:** Same issue seen in both orchestrator analysis and CLI agent source code review. Merge into one finding with both evidence sources.
- **Orchestrator-only findings:** Issues from coverage enumeration that agents didn't flag. Keep as-is.
- **Agent-only findings:** Deeper issues agents found via source code analysis that the orchestrator missed. Keep as-is in a separate section.
- **Duplicate agent findings:** Two CLI agents found the same issue. Keep the version with the strongest evidence, note cross-validation.

### Step 4: Cross-Reference and Re-Rank

Apply these severity adjustment rules:

| Condition | Adjustment |
|-----------|-----------|
| CLI failure: wrong correctBid (app recommends wrong bid) | Always CRITICAL — never downgrade |
| CLI failure: bad feedback (correct call but wrong explanation) | At least MAJOR |
| Orchestrator finding confirmed by CLI agent | Boost confidence, keep severity |
| Found by 2+ CLI agents independently | Upgrade severity one level |
| Contradicts ACBL regulations or Laws of Bridge | Always CRITICAL |
| Terminology issue that would confuse a novice | At least MAJOR |
| Selftest skip (strategy returned null) | Informational — separate section |
| Agent marked CRITICAL but evidence is ambiguous | Keep CRITICAL, flag for manual review |
| **Feature gap** (missing functionality, not wrong behavior) | **Separate section — do NOT mix with correctness errors** |

### Step 5: Categorize

**First, separate correctness errors from feature gaps and unreachable states.** These are fundamentally different:
- Correctness errors (from orchestrator + CLI agents) go in the main issue list with severity rankings
- Coverage gaps go in a "Coverage Gaps" section
- Feature gaps go in a "Feature Gaps" section at the end
- Unreachable states go in an "Unreachable States" section (informational)

Group correctness findings into action categories:

1. **Convention Logic Errors** — The convention spec implements the wrong rule (from CLI agent analysis)
2. **Teaching Content Errors** — Explanations, feedback text, or teaching labels are incorrect (from CLI agent analysis)
3. **Alert/Announcement Violations** — Alert rules don't follow ACBL standards (from CLI agent analysis)
4. **Coverage Completeness Issues** — Missing states, unexpected unreachable states (from CLI coverage output)
5. **Terminology Errors** — Bridge terms used incorrectly in source code (from CLI agent analysis)

### Step 6: Produce Compiled Report

Output the final report in this format:

```
# Bridge Expert Review — Compiled Report

**Date:** [date]
**Method:** CLI coverage-runner (Tier 1) + CLI evaluation agents (Tier 2)
**Scope:** [conventions tested]

## CLI Coverage Metrics
| Metric | Value |
|--------|-------|
| Targets tested | N |
| First-attempt accuracy | X% |
| Post-feedback accuracy | Y% |
| Selftest pass rate | P/T (X%) |
| Failures (CRITICAL) | N |
| Failures (MAJOR) | N |

## Overall Verdict
[PASS / FAIL / CONDITIONAL PASS]
[Would an expert bridge player trust this app? One paragraph grounded in the CLI metrics above.]

## Issue Summary
| Source | Severity | Count | Categories |
|--------|----------|-------|-----------|
| Orchestrator | CRITICAL | N | [which categories] |
| Orchestrator | MAJOR | N | [which categories] |
| CLI Agents | CRITICAL | N | [which categories] |
| CLI Agents | MAJOR | N | [which categories] |
| CLI Agents | MINOR | N | [which categories] |
| **Total** | | **N** | |

## Critical Issues (fix before any expert sees this app)

### 1. [Title]
- **Source:** Orchestrator / CLI Agent / Both
- **Category:** [from Step 5 categories]
- **Convention:** [convention ID]
- **Coverage atom:** [baseStateId / surfaceId]
- **What the code does:** [from `grade` JSON — correctBid, feedback]
- **What is correct:** [with reference]
- **Reference:** [URL or standard]
- **Evidence:** [CLI output or source code excerpt]
- **Recommended fix:** [brief description of what needs to change]

[...repeat for all critical issues...]

## Major Issues

[...same format...]

## Minor Issues (UI rendering, cosmetic)

[...same format, can be more compact...]

## What the App Gets Right
[List things the CLI passed and agents noted as correct — important for calibration]

## Testing Coverage
| Source | Scope | Atoms/Items Reviewed | Issues Found |
|--------|-------|---------------------|-------------|
| Orchestrator | [conventions] | N atoms | N findings |
| CLI Agent: [agent 1 name] | [scope] | N atoms | N findings |
| CLI Agent: [agent 2 name] | [scope] | N items | N findings |
| ... | ... | ... | ... |

## Selftest Skips
| Bundle | Atom | Details |
|--------|------|---------|
[...from `selftest` output where status="skip"...]

## Feature Gaps (missing functionality, NOT correctness errors)
- [Features that don't exist yet but would improve the app]

## Recommended Fix Priority
1. [Most impactful fix — may resolve multiple CLI failures]
2. [Next...]
3. [...]
```

### Step 7: Suggest Next Steps

Based on the compiled report, suggest:
- Which issues to fix first (group by root cause when possible — a single convention spec fix may resolve multiple findings)
- Whether a re-run of the CLI is needed after fixes (`npx tsx src/cli/coverage-runner.ts selftest --all --seed=42` to verify)
- Any areas that need deeper investigation
- Whether selftest skips represent design gaps or expected constraints
