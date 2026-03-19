# SkillIntent — BridgeExpertReview

> **For agents modifying this skill:** Read this before making any changes.

## First Principles

1. **CLI-first evaluation, browser for rendering.** Convention correctness is tested by the headless CLI coverage-runner, which exercises every (state, surface) pair via the PlayerViewport information boundary. Browser agents validate only what the CLI cannot: visual rendering, layout, suit symbols, and navigation UX. This separation ensures comprehensive logic testing (CLI is fast and exhaustive) while still catching rendering bugs (browser sees what users see).

2. **Adversarial posture reveals real quality.** A friendly tester forgives ambiguity. An adversarial expert exposes it. The zero-tolerance framing produces higher-signal feedback because it mirrors how real expert bridge players evaluate teaching tools.

3. **Evidence over opinion.** Every finding must include what was observed (CLI viewport JSON or browser screenshot) and what is correct per an authoritative source. Unfounded claims waste developer time and erode trust in the review process.

4. **Quantitative metrics ground the verdict.** CLI coverage-runner produces first-attempt accuracy, post-feedback accuracy, infeasible pair counts, and coverage percentages. These numbers are the primary quality signals — not subjective impressions from browser exploration.

5. **Bridge correctness is non-negotiable.** In a teaching app, a wrong answer taught confidently is worse than no answer at all. Convention logic errors are always critical severity, regardless of frequency or edge-case status.

## Problem This Skill Solves

Manual QA of bridge convention correctness requires deep domain knowledge that most testers lack. Code review catches implementation bugs but not semantic errors (e.g., the code correctly implements a wrong convention rule). This skill automates expert-level domain review using a two-tier approach: the CLI coverage-runner exhaustively tests every bidding state for convention correctness (fast, deterministic, comprehensive), while browser agents validate the visual rendering layer that the CLI cannot assess.

## Design Decisions

| Decision | Chosen Approach | Alternatives Rejected | Why |
|---|---|---|---|
| CLI-first testing | CLI coverage-runner for logic, browser for UI | Browser-only evaluation | CLI tests every (state, surface) pair exhaustively in seconds. Browser agents are slow, non-deterministic, and can't guarantee full coverage. CLI + browser gives both comprehensive logic testing and visual validation. |
| PlayerViewport boundary | CLI uses BiddingViewport (what player sees), never EvaluationOracle | CLI reads source code directly | The viewport boundary preserves the "evaluate what the user sees" principle. The CLI interacts through the same information boundary as the UI, just without rendering. |
| 3 browser agents (down from 5) | UI Rendering, Alert & Annotation, Navigation & Flow | Keep all 5 browser agents | Convention correctness and teaching feedback moved to CLI. Browser agents focus purely on rendering — 3 is sufficient for UI validation. |
| Structured JSON output | CLI produces machine-parseable JSON with viewport snapshots | Free-form text output | JSON enables automated compilation, quantitative metrics, and precise failure identification. No ambiguity in results. |
| Deterministic seeds | `--seed=42` for reproducible CLI runs | Random seeds | Deterministic = reproducible results. Same seed always produces same failures, enabling regression testing. |
| Two-phase coverage algorithm | CLI uses optimized two-phase algorithm for all (state, surface) pairs | Random seed exploration | Two-phase guarantees every reachable state/surface is tested. Random exploration has coverage gaps. |
| Adversarial persona (browser) | Zero-tolerance expert framing for browser agents | Friendly tester | Adversarial framing catches rendering edge cases that friendly testing misses. |
| Quantitative metrics | First-attempt accuracy, post-feedback accuracy, coverage % | Subjective verdict only | Numbers ground the verdict. "98% first-attempt accuracy with 2 CRITICAL failures" is more actionable than "mostly correct." |

## Explicit Out-of-Scope

- **Code fixes.** This skill finds problems, it does not fix them. Fixes are a separate task after review.
- **Performance testing.** Load times, memory usage, and rendering performance are outside scope.
- **Accessibility audit.** Screen reader compatibility, WCAG compliance, etc. are separate concerns.
- **Mobile/responsive testing.** Browser agents test at default viewport. Responsive behavior is separate.
- **Source code quality.** Architecture, naming, test coverage — none of this is in scope.
- **EvaluationOracle access.** The CLI uses BiddingViewport only. The answer key (EvaluationOracle) is never exposed to the evaluation — the CLI validates the app's recommendations against bridge rules, not against its own internal answer key.

## Success Criteria

1. CLI coverage-runner tests 100% of reachable (state, surface) pairs with structured JSON output.
2. First-attempt accuracy and post-feedback accuracy metrics are computed and reported.
3. Every CLI failure includes the BiddingViewport (hand, auction, alerts) and a bridge reference URL.
4. Every browser finding includes a screenshot path or DOM text excerpt.
5. The compiled report separates CLI correctness findings from browser rendering findings.
6. A convention correctness error is never ranked below CRITICAL severity.
7. Infeasible pairs are logged but not flagged as errors.
8. The skill never modifies app source code. It is read-only with respect to the codebase.

## Constraints

- The CLI coverage-runner runs without a dev server — it exercises the evaluation pipeline headlessly.
- Browser agents use `subagent_general` profile (need exec + write for Playwright scripts).
- The dev server must be running before browser agents start. The orchestrator verifies this.
- Browser agents must webfetch at least 2 independent bridge sources when flagging a convention error found via browser inspection.
- The skill never modifies app source code. It is read-only with respect to the codebase.
- CLI seeds must be documented for reproducibility (`--seed=42` by default).
