# SkillIntent — BridgeExpertReview

> **For agents modifying this skill:** Read this before making any changes.

## First Principles

1. **CLI-first evaluation, browser for rendering.** Convention correctness is tested by the headless CLI coverage-runner, which exercises every (state, surface) pair via the PlayerViewport information boundary. CLI evaluation agents perform deep convention analysis using `exec` and `read` tools — never the browser skill. All spawned agents use CLI commands and source code analysis.

2. **Adversarial posture reveals real quality.** A friendly tester forgives ambiguity. An adversarial expert exposes it. The zero-tolerance framing produces higher-signal feedback because it mirrors how real expert bridge players evaluate teaching tools.

3. **Evidence over opinion.** Every finding must include what was observed (CLI output or source code excerpt) and what is correct per an authoritative source. Unfounded claims waste developer time and erode trust in the review process.

4. **Quantitative metrics ground the verdict.** CLI coverage-runner produces first-attempt accuracy, post-feedback accuracy, selftest pass rate, and coverage percentages. These numbers are the primary quality signals — not subjective impressions.

5. **Bridge correctness is non-negotiable.** In a teaching app, a wrong answer taught confidently is worse than no answer at all. Convention logic errors are always critical severity, regardless of frequency or edge-case status.

## Problem This Skill Solves

Manual QA of bridge convention correctness requires deep domain knowledge that most testers lack. Code review catches implementation bugs but not semantic errors (e.g., the code correctly implements a wrong convention rule). This skill automates expert-level domain review using a two-tier approach: the CLI coverage-runner tests every coverage atom via `selftest`/`eval`/`play` for convention correctness (fast, deterministic, comprehensive), while CLI evaluation agents deep-dive into specific conventions or problem areas using the same CLI and source code analysis.

## Design Decisions

| Decision | Chosen Approach | Alternatives Rejected | Why |
|---|---|---|---|
| CLI-first testing | CLI coverage-runner with `bundles`/`describe`/`list`/`eval`/`play`/`selftest`/`plan` for logic, CLI agents for deep analysis | Browser-only evaluation | CLI tests every coverage atom exhaustively in seconds. Browser agents are slow, non-deterministic, and can't guarantee full coverage. |
| All agents use CLI | Spawned agents use `exec` + `read`, never browser skill | Browser agents for UI validation | Browser skill is unreliable for convention correctness testing. CLI + source code analysis is deterministic and comprehensive. |
| PlayerViewport boundary | CLI uses BiddingViewport (what player sees), never EvaluationOracle | CLI reads source code directly | The viewport boundary preserves the "evaluate what the user sees" principle. |
| Dynamic agent count | Orchestrator decides agent count and focus based on scope | Fixed 3 or 5 agents | Different review scopes need different parallelism. One convention needs fewer agents than four. Orchestrator assigns non-overlapping scopes. |
| Structured evidence | CLI output + source code excerpts as evidence | Free-form text output | Structured evidence enables precise failure identification and reproducibility. |
| Deterministic seeds | `--seed=42` for reproducible CLI runs | Random seeds | Deterministic = reproducible results. Same seed always produces same failures, enabling regression testing. |
| Two-phase coverage algorithm | CLI uses optimized two-phase algorithm for all (state, surface) pairs | Random seed exploration | Two-phase guarantees every reachable state/surface is tested. Random exploration has coverage gaps. |

## Explicit Out-of-Scope

- **Code fixes.** This skill finds problems, it does not fix them. Fixes are a separate task after review.
- **Performance testing.** Load times, memory usage, and rendering performance are outside scope.
- **Accessibility audit.** Screen reader compatibility, WCAG compliance, etc. are separate concerns.
- **Mobile/responsive testing.** Browser agents test at default viewport. Responsive behavior is separate.
- **Source code quality.** Architecture, naming, test coverage — none of this is in scope.
- **EvaluationOracle access.** The CLI uses BiddingViewport only. The answer key (EvaluationOracle) is never exposed to the evaluation — the CLI validates the app's recommendations against bridge rules, not against its own internal answer key.

## Success Criteria

1. CLI coverage-runner `selftest` runs across all bundles with structured JSON output.
2. First-attempt accuracy, post-feedback accuracy, and selftest pass rate metrics are computed and reported.
3. Every failure includes the viewport (from `eval`) and a bridge reference URL.
4. CLI evaluation agents use `exec` and `read` tools — never the browser skill.
5. The compiled report separates orchestrator findings from CLI agent findings.
6. A convention correctness error is never ranked below CRITICAL severity.
7. Selftest skips are logged but not flagged as errors.
8. The skill never modifies app source code. It is read-only with respect to the codebase.

## Constraints

- The CLI coverage-runner runs without a dev server — it exercises the evaluation pipeline headlessly.
- CLI evaluation agents use `subagent_general` profile (need exec + read for CLI commands and source analysis).
- All spawned agents use CLI tools (`exec`, `read`, `webfetch`) — never the browser skill or Playwright.
- Agents must webfetch at least 2 independent bridge sources when flagging convention errors.
- The skill never modifies app source code. It is read-only with respect to the codebase.
- CLI seeds must be documented for reproducibility (`--seed=42` by default).
