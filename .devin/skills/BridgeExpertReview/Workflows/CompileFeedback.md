# CompileFeedback Workflow

> **Trigger:** "compile bridge feedback", "summarize review results", "prioritize bridge issues"

## Reference Material

- **Evaluation Framework:** `../Standards/EvaluationFramework.md`

## Purpose

Take CLI coverage-runner JSON output and browser UI agent reports and compile them into a single, deduplicated, prioritized action list with quantitative metrics.

## Input Sources

| Source | Type | Contains |
|--------|------|----------|
| **CLI JSON output** | Structured JSON | Per-target pass/fail, viewport snapshots, expected/actual calls, feedback text, first-attempt & post-feedback accuracy |
| **Browser agent reports** | Structured text | UI rendering issues — suit symbols, alert display, layout, navigation |

## Workflow Steps

### Step 1: Parse CLI JSON Results

Read the CLI coverage-runner JSON output. Extract:

1. **Aggregate metrics:**
   - Total targets tested
   - First-attempt accuracy (% correct on first try)
   - Post-feedback accuracy (% correct after seeing feedback)
   - Infeasible pair count
   - Failure count by severity

2. **Per-failure details:**
   - Convention, targetState, targetSurface
   - BiddingViewport (hand, auction, alerts, legal calls)
   - Expected call vs actual call
   - Feedback text
   - Result category (FAIL — wrong call, FAIL — bad feedback, etc.)

3. **Infeasible pairs list** — these are (state, surface) combinations where no deal can reach that state. Log them but do not flag as errors.

### Step 2: Collect Browser Agent Reports

Gather UI reports from the 3 browser agents (UI Rendering, Alert & Annotation, Navigation & Flow). Each report follows the structured format from `RunReview.md` Step 9.

### Step 3: Merge and Deduplicate

Compare findings across CLI results and all browser agents:

- **CLI failure + browser confirmation:** Same issue seen in both CLI JSON (wrong call) and browser screenshot. Merge into one finding with both evidence sources.
- **CLI-only findings:** Convention logic errors that don't need visual confirmation. Keep as-is.
- **Browser-only findings:** UI rendering issues the CLI can't detect (wrong suit colors, truncated text, broken layout). Keep as-is in a separate UI section.
- **Duplicate browser findings:** Two browser agents found the same rendering issue. Keep the version with the strongest evidence, note cross-validation.

### Step 4: Cross-Reference and Re-Rank

Apply these severity adjustment rules:

| Condition | Adjustment |
|-----------|-----------|
| CLI failure: wrong expected call (app recommends wrong bid) | Always CRITICAL — never downgrade |
| CLI failure: bad feedback (correct call but wrong explanation) | At least MAJOR |
| CLI failure confirmed by browser agent seeing wrong UI | Boost confidence, keep severity |
| Found by 2+ browser agents independently | Upgrade severity one level |
| Contradicts ACBL regulations or Laws of Bridge | Always CRITICAL |
| Terminology issue that would confuse a novice | At least MAJOR |
| UI rendering issue only (cosmetic, no bridge knowledge impact) | Cap at MINOR |
| Agent marked CRITICAL but evidence is ambiguous | Keep CRITICAL, flag for manual review |
| **Feature gap** (missing functionality, not wrong behavior) | **Separate section — do NOT mix with correctness errors** |
| **Infeasible pair** (no deal can reach this state/surface) | **Separate section — not an error** |

### Step 5: Categorize

**First, separate correctness errors from feature gaps and infeasible pairs.** These are fundamentally different:
- Correctness errors (from CLI + browser) go in the main issue list with severity rankings
- UI rendering issues (browser-only) go in a "UI Issues" section
- Feature gaps go in a "Feature Gaps" section at the end
- Infeasible pairs go in an "Infeasible Pairs" section (informational)

Group correctness findings into action categories:

1. **Convention Logic Errors** — The app recommends the wrong bid or grades a correct bid as wrong (from CLI)
2. **Teaching Content Errors** — Explanations, feedback text, or "why not X?" reasoning is incorrect (from CLI)
3. **Alert/Announcement Violations** — Alerts missing, wrong, or not following ACBL standards (from CLI + browser)
4. **UI Rendering Errors** — Suit symbols, card display, layout issues (from browser only)
5. **Terminology Errors** — Bridge terms used incorrectly or non-standardly (from browser)
6. **Navigation/Flow Issues** — Coverage URLs broken, state loss, transitions wrong (from browser)

### Step 6: Produce Compiled Report

Output the final report in this format:

```
# Bridge Expert Review — Compiled Report

**Date:** [date]
**Method:** CLI coverage-runner (Tier 1) + Browser UI agents (Tier 2)
**Scope:** [conventions/bundles tested]
**CLI seed:** 42

## CLI Coverage Metrics
| Metric | Value |
|--------|-------|
| Targets tested | N |
| First-attempt accuracy | X% |
| Post-feedback accuracy | Y% |
| Infeasible pairs | Z |
| Failures (CRITICAL) | N |
| Failures (MAJOR) | N |

## Overall Verdict
[PASS / FAIL / CONDITIONAL PASS]
[Would an expert bridge player trust this app? One paragraph grounded in the CLI metrics above.]

## Issue Summary
| Source | Severity | Count | Categories |
|--------|----------|-------|-----------|
| CLI | CRITICAL | N | [which categories] |
| CLI | MAJOR | N | [which categories] |
| Browser | CRITICAL | N | [which categories] |
| Browser | MAJOR | N | [which categories] |
| Browser | MINOR | N | [which categories] |
| **Total** | | **N** | |

## Critical Issues (fix before any expert sees this app)

### 1. [Title]
- **Source:** CLI / Browser / Both
- **Category:** [from Step 5 categories]
- **Convention:** [bundle/convention ID]
- **Target:** [targetState / targetSurface]
- **What the app does:** [exact behavior — from CLI viewport or browser screenshot]
- **What is correct:** [with reference]
- **Reference:** [URL or standard]
- **Evidence:** [CLI viewport JSON or screenshot path]
- **Recommended fix:** [brief description of what needs to change]

[...repeat for all critical issues...]

## Major Issues

[...same format...]

## Minor Issues (UI rendering, cosmetic)

[...same format, can be more compact...]

## What the App Gets Right
[List things the CLI passed and agents noted as correct — important for calibration]

## Testing Coverage
| Source | Scope | Targets/Scenarios | Issues Found |
|--------|-------|-------------------|-------------|
| CLI | [bundles] | N targets | N failures |
| Browser: UI Rendering | [screens checked] | N scenarios | N issues |
| Browser: Alerts | [screens checked] | N scenarios | N issues |
| Browser: Navigation | [URLs tested] | N scenarios | N issues |

## Infeasible Pairs
| Convention | Target State | Target Surface |
|-----------|-------------|---------------|
[...from CLI output...]

## Feature Gaps (missing functionality, NOT correctness errors)
- [Features that don't exist yet but would improve the app]

## Recommended Fix Priority
1. [Most impactful fix — may resolve multiple CLI failures]
2. [Next...]
3. [...]
```

### Step 7: Suggest Next Steps

Based on the compiled report, suggest:
- Which issues to fix first (group by root cause when possible — a single FSM state fix may resolve multiple CLI failures)
- Whether a re-run of the CLI coverage-runner is needed after fixes (`npx tsx src/cli/coverage-runner.ts --all --json --seed=42` to verify)
- Any areas that need deeper browser investigation (e.g., "Alert rendering on mobile viewports was not tested")
- Whether infeasible pairs represent design gaps or expected constraints
