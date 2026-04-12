# SkillIntent — BridgeExpertReview

> **For agents modifying this skill:** Read this before making any changes.

## First Principles

1. **Project-local review beats generic review.** This skill is only useful inside this repository because it depends on the current fixture layout, CLI commands, and teaching DTOs. Keep it repo-local and describe the repo as it exists today.

2. **Fixture completeness comes before runtime correctness.** If a surface was never authored, no amount of playthrough testing will discover it reliably. Start with the module fixture JSON, its `references.authority`, and its `states[].surfaces`.

3. **CLI-first evaluation, browser for rendering.** Runtime correctness is tested through `src/cli/main.ts`, which exercises the same session API the app uses. Review agents use `exec` and `read`, not browser automation.

4. **Evidence over opinion.** Every finding needs both sides of the comparison: what the app currently does and what the authority reference says instead.

5. **Bridge correctness is non-negotiable.** A wrong convention recommendation or wrong teaching explanation is a credibility failure, even if it only appears on a narrow branch.

## Problem This Skill Solves

Manual review of bridge convention behavior requires both bridge expertise and knowledge of this project's fixture-driven Rust pipeline. Generic QA catches crashes and layout issues, but it does not reliably catch missing convention surfaces, wrong hand requirements, or misleading teaching text. This skill packages that repo-specific review process into a repeatable workflow.

## Design Decisions

| Decision | Chosen Approach | Alternatives Rejected | Why |
|---|---|---|---|
| Source of truth | Repo-local skill in `skills/BridgeExpertReview` | Shared home-directory skill | The workflow depends on this repo's CLI and fixture structure. Keeping it in-repo prevents cross-project drift. |
| Completeness audit | Read `crates/bridge-conventions/fixtures/modules/*.json` and authority references | Infer coverage only from runtime playthroughs | Missing fixture surfaces are easiest to spot before running seeds. |
| Runtime verification | `selftest` plus `play` / `play --bids` loops | Browser automation | The CLI is deterministic and hits the same session path as the app. |
| Agent tooling | `exec` + `read` only | Browser or UI screenshot tooling | This skill audits convention correctness, not visual polish. |
| Parallelism | Dynamic seed/module partitioning | Fixed agent count | Different review scopes need different amounts of work. |
| Isolation | Disposable git worktree under `/tmp` | Running in the main worktree | Review should not interfere with local edits. |

## Explicit Out-of-Scope

- Code fixes. This skill reviews; it does not implement fixes.
- UI design and responsive behavior.
- Performance profiling.
- Accessibility audits.
- Non-bridge code quality concerns unrelated to convention correctness.

## Success Criteria

1. The skill names only CLI commands that actually exist in `src/cli/main.ts`.
2. Completeness audit instructions point at fixture JSON and `references.authority`.
3. Runtime review instructions use `selftest`, `play`, and `play --bids` accurately.
4. Findings separate missing surfaces from runtime correctness errors.
5. The workflow remains read-only with respect to app source code.

## Constraints

- Supported base systems are the static CLI values: `sayc`, `two-over-one`, and `acol`.
- Module fixtures live in `crates/bridge-conventions/fixtures/modules/`.
- Runtime review uses the CLI only; no browser tooling.
- Every correctness claim must cite a fetched authority URL.
- The skill should remain useful after a fresh clone plus `npm install`, using repo-local symlinks created by `scripts/link-project-skills.sh`.
