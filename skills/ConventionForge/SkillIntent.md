# SkillIntent — ConventionForge

> **For agents modifying this skill:** Read this before making changes.

## First Principles

1. **One authority per convention, not one-size-fits-all.** Each convention has a single designated authority stored in the module fixture's `references.authority` field. ACBL SAYC booklet is authority for standardized conventions (Stayman, Blackwood, Transfers). Larry Cohen is authority for conventions he co-invented (Bergen Raises, Negative Doubles). Bridge Guys is authority for conventions needing comprehensive continuation coverage (DONT, NMF, Michaels). Bridgebum.com (`references.discovery`) is a discovery source — useful for finding conventions and getting an overview, but never the authority for HCP thresholds or hand requirements. Never author surfaces from memory — always fetch and read the authority reference.

2. **Build and Verify are complementary, not redundant.** Build creates or fills gaps in convention modules by translating reference material into code artifacts. Verify checks existing modules for correctness against the same references, then stress-tests them with expert playthrough agents. A convention should be Built first, then Verified.

3. **Reference comparison before playthrough.** Playthrough testing (BridgeExpertReview) only catches bugs in surfaces that exist. Missing surfaces silently fall through to Pass or wrong natural bids. Always compare against the reference first to catch completeness gaps, then run playthrough to catch correctness bugs in existing surfaces.

4. **Convention authoring follows the established checklist.** New modules follow `docs/guides/convention-authoring.md` exactly — surfaces, facts, FSM rules, explanation catalog, semantic classes, system profile, registration. The Build workflow doesn't invent new patterns; it translates reference material into the existing authoring framework.

5. **Verify delegates playthrough to BridgeExpertReview.** ConventionForge doesn't reinvent the playthrough evaluation pipeline. Phase 2 of Verify invokes BridgeExpertReview with a targeted scope (specific bundle, 10 agents). This avoids duplicating the evaluation framework, agent prompt templates, and report compilation logic.

## Problem This Skill Solves

Adding a new convention module requires deep bridge domain knowledge AND familiarity with the app's authoring framework. Without a structured workflow, convention authors either miss bidding sequences (incomplete surfaces) or implement rules from memory that diverge from standard references (incorrect surfaces). This skill bridges the gap by anchoring all authoring and verification work to authoritative external references.

Verification has a similar gap: selftest catches self-consistency errors but not semantic errors (the code correctly implements the wrong rule). Reference comparison + expert playthrough catches both.

## Design Decisions

| Decision | Chosen Approach | Alternatives Rejected | Why |
|---|---|---|---|
| Reference source | Per-convention tier-1 authority (ACBL SAYC booklet, Larry Cohen, Karen Walker); bridgebum and Wikipedia are discovery only | Wikipedia as authority; bridgebum as authority; three-tier primary/discovery/secondary | Wikipedia prose is too thin to pin meanings — verified drift across 7 modules before 2026-04-17. Bridgebum is an aggregator with internal contradictions. Cohen / Walker / ACBL booklet are the closest live proxies for modal US teaching. Full tier table + Category A vs Category B split + invariants live in `docs/architecture/authority-and-module-composition.md`. |
| Module composition | `delegate_to` FSM scope for additive modules; bundles for co-loaded modules; planned `requires` field for enforced dependency | `variantOf` as "extends"; duplicating surfaces across modules | `variantOf` is only a user-fork replacement mechanism (`registry/spec_builder.rs`) and does not wire FSMs or declare dependency. Duplicating surfaces across modules causes silent drift (base and variant disagree on the same bid). Delegating explicitly keeps one module as the single source of truth per bid meaning. See `docs/architecture/authority-and-module-composition.md` Part 2. |
| Build output | Rust module files (surfaces in JSON fixtures, FSM in Rust) | TS module files | Backend is fully migrated to Rust. Convention modules are Rust crates with JSON fixtures. |
| Verify Phase 2 | Delegate to BridgeExpertReview skill | Built-in playthrough | BridgeExpertReview already has the evaluation framework, agent personas, CLI integration, worktree isolation, and report compilation. Duplicating this would be maintenance debt. |
| Agent count for Verify | 10 agents default | 3 or 5 | 10 agents provides sufficient seed coverage for a single convention (100+ seeds across agents) while staying within reasonable parallelism. |
| Reference comparison scope | Per-module, not per-bundle | Per-bundle comparison | Modules are independent units. Per-module comparison produces actionable findings tied to specific module files. |

## Explicit Out-of-Scope

- **System-specific variations.** ConventionForge builds conventions for the default system (SAYC). System-fact gating for 2/1 differences is a separate concern handled after initial authoring.
- **UI/UX review.** How the convention appears in the browser is not in scope. ConventionForge is about convention logic correctness.
- **Performance optimization.** Pipeline performance, FSM efficiency, and surface evaluation speed are separate concerns.
- **Teaching quality.** Explanation catalog entries are scaffolded but not reviewed for pedagogical quality. That's a content review, not a convention authoring task.

## Constraints

- All convention modules live in `crates/bridge-conventions/` (Rust) with JSON fixtures in `crates/bridge-conventions/fixtures/`.
- Surfaces are defined in JSON fixture files, not Rust code directly.
- The Build workflow must follow `docs/guides/convention-authoring.md` for file structure and naming.
- The Verify workflow's Phase 2 requires the BridgeExpertReview skill to be available.
- All reference fetches use `webfetch` — never work from cached or memorized convention rules.
- Convention modules follow the Rust/WASM architecture — no TS convention code.
