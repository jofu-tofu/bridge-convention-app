# Conventions

Convention definitions for bridge bidding practice. Each convention is a self-contained module with deal constraints, bidding rules, and examples.

## Conventions

- **Registry pattern.** All conventions register via `registerConvention()` in `core/registry.ts`. Never hardcode convention logic in switch statements.
- **Contract boundary.** Cross-module DTOs such as `BiddingContext` come from `src/core/contracts/`; convention internals must not leak `core/` types across that boundary.
- **One folder per convention.** Each convention in `definitions/` is a folder with `tree.ts`, `config.ts`, `explanations.ts`, `index.ts` (and optionally `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`). See `definitions/stayman/` as the reference implementation.
- **Core vs definitions split.** `core/` contains stable infrastructure (registry, evaluator, tree system, conditions). `definitions/` contains convention folders that grow unboundedly. When `definitions/` exceeds ~20 folders, introduce category subdirectories.
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`. Importing `conventions/index` activates all conventions.
- **Rule name strings are public contract.** Rule names appear in CLI JSON output and tests. Renaming is a breaking change.
- **`evaluateBiddingRules(context, config, lookupConvention?)` dispatches protocol only.** Takes `BiddingContext`, `ConventionConfig`, and optional `ConventionLookup` DI seam. All conventions use `ConventionProtocol`; throws if no protocol. After protocol evaluation, applies active overlay (if any).

**Context tree:**
- `core/CLAUDE.md` — protocol, dialogue, intent, tree, overlay systems
- `definitions/CLAUDE.md` — convention authoring guide, rules reference, test organization

## Conditioned Rules

- **`conditionedRule()` applies only to flat-rule authoring.** In rule-tree protocol conventions, use `handDecision()` + `intentBid()`; in flat-rule paths, use `conditionedRule()` from `conditions.ts`. Never hand-build a `ConditionedBiddingRule` object.
- **Auction/hand condition split (flat-rule paths).** `conditionedRule()` requires explicit `auctionConditions` and `handConditions` arrays (both required, use `[]` if empty).
- **Hybrid conditions belong in `handConditions`.** Conditions that check auction state to resolve parameters but gate on hand properties (e.g., `majorSupport()`) belong in `handConditions`. Inference iterates only `handConditions` for `.inference`.
- **Auction conditions must NOT carry `.inference` metadata** — enforced by test.
- **`or()` always-evaluate invariant.** `or()` MUST evaluate all branches unconditionally — short-circuiting breaks UI branch-highlighting. Max 4 branches, nesting depth ≤ 2.
- **Imperative escape hatch.** A rule MAY stay as plain `BiddingRule` if the declarative model cannot express its logic. New conventions should prefer rule trees.

## Gotchas

- Many legacy integration tests call `clearRegistry()` in `beforeEach` for isolation; prefer `lookupConvention` injection for registry-free unit tests
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- Bergen Raises variant is Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Conventions with `internal: true` are filtered from the UI by `filterConventions()` in `src/core/display/filter-conventions.ts`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `core/registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-03-03 | version=11 | dir-commits-at-audit=52 | tree-sig=dirs:22,files:110,exts:ts:109,md:3 -->
