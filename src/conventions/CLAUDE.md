# Conventions

Convention definitions for bridge bidding practice. Each convention is a self-contained module with deal constraints, bidding rules, and examples.

## Conventions

- **Registry pattern.** All conventions register via `registerConvention()` in `core/registry.ts`. Never hardcode convention logic in switch statements.
- **One file per convention.** Each convention in `definitions/` exports a `ConventionConfig` (types in `core/types.ts`). See `definitions/stayman.ts` as the reference implementation.
- **Core vs definitions split.** `core/` contains stable infrastructure (registry, evaluator, tree system, conditions). `definitions/` contains convention files that grow unboundedly. When `definitions/` exceeds ~20 files, introduce category subdirectories (responses/, competitive/, slam/, etc.).
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`. Importing `conventions/index` activates all conventions.
- **Rule name strings are public contract.** Rule names (e.g., `stayman-ask`, `stayman-response-hearts`) appear in CLI JSON output and are used in tests. Renaming a rule name is a breaking change.
- **`evaluateBiddingRules(context, config)` is tree-only.** Takes `BiddingContext` and `ConventionConfig` (no `rules` param). Dispatches via tree evaluator for all conventions.

## Architecture

**Module graph:**

```
core/
  types.ts (ConventionConfig, BiddingRule, BiddingContext, RuleCondition, ConditionedBiddingRule)
    ↑
  conditions/ (split subsystem: auction-conditions, hand-conditions, rule-builders)
  conditions.ts (barrel re-export for backward compat)
  condition-evaluator.ts (evaluateConditions, buildExplanation, isConditionedRule)
  rule-tree.ts (RuleNode, DecisionNode, BidNode, FallbackNode, TreeConventionConfig, builder helpers)
  tree-evaluator.ts (evaluateTree, TreeEvalResult, PathEntry)
  tree-compat.ts (flattenTree, treeResultToBiddingRuleResult — temporary compat adapter)
  sibling-finder.ts (findSiblingBids — sibling bids in same auction context)
  context-factory.ts (createBiddingContext — canonical BiddingContext constructor)
    ↑
  registry.ts (registerConvention, getConvention, evaluateBiddingRules — dispatches tree conventions)
    ↑
definitions/
  stayman.ts (staymanConfig, staymanDealConstraints)
gerber.ts (gerberConfig, gerberDealConstraints)
bergen-raises.ts (bergenConfig, bergenDealConstraints)
dont.ts (dontConfig, dontDealConstraints)
landy.ts (landyConfig, landyDealConstraints)
sayc.ts (saycConfig — user-drillable, South 10+ HCP)
  ↑
index.ts (auto-registration entry point)
```

**Key core files:** `types.ts` (all interfaces), `conditions/` (split subsystem: auction/hand/rule-builders), `condition-evaluator.ts` (evaluate + explain), `rule-tree.ts` (node types + builders), `tree-evaluator.ts` (evaluateTree), `tree-compat.ts` (flattenTree + result adapter), `sibling-finder.ts` (sibling alternatives), `context-factory.ts` (createBiddingContext), `registry.ts` (convention map + dispatch).

**Definitions:** 6 conventions (stayman, gerber, bergen-raises, dont, landy, sayc). `index.ts` auto-registers all.

## Convention Rules Reference

Per-convention rule details (deal constraints, rule names, priority order, HCP ranges): see `docs/conventions/` and the definition files in `definitions/`. Key facts for quick orientation:

- **Stayman/Gerber:** Respond to NT openings. Stayman includes Smolen + 2NT Stayman at 3-level.
- **Bergen Raises:** Multi-round framework (constructive/limit/preemptive + opener rebids + game try continuations). Standard Bergen variant.
- **Landy/DONT:** Both declare `allowedDealers: [East, West]` — drill infrastructure randomly picks dealer and rotates constraints 180° when West is chosen. Landy = 2C both majors. DONT = double/suited overcalls.
- **SAYC:** User-drillable, also E/W opponent AI default. 40+ flattened rules covering openings, responses, rebids, competitive.

**Bridge rules sources:** See `docs/bridge-rules-sources.md` for authoritative references and ambiguity resolution.

## Conditioned Rules

- **`conditionedRule()` factory mandate.** All new rules MUST use `conditionedRule()` from `conditions.ts`. Never hand-build a `ConditionedBiddingRule` object (risks split-brain between `matches()` and `conditions[]`).
- **Auction/hand condition split.** `conditionedRule()` requires explicit `auctionConditions` and `handConditions` arrays (both required, use `[]` if empty). The flattened `.conditions` getter provides backward compat for `evaluateConditions()` and `buildExplanation()`.
- **Hybrid conditions belong in `handConditions`.** Conditions like `majorSupport()`, `gerberSignoffCondition()`, `advanceSupportFor()` that check auction state to resolve parameters but ultimately gate on hand properties belong in `handConditions`, not `auctionConditions`. The inference engine iterates only `handConditions` for `.inference` metadata.
- **Auction conditions must NOT carry `.inference` metadata** — enforced by test in `conditions.test.ts`.
- **`or()` always-evaluate invariant.** `or()` MUST evaluate all branches unconditionally — short-circuiting breaks the UI branch-highlighting feature. Max 4 branches, nesting depth ≤ 2.
- **Imperative escape hatch.** A rule MAY stay as plain `BiddingRule` (with static `explanation`) if the declarative model cannot express its logic. All rules across 5 conventions use `conditionedRule()`. New conventions should use `conditionedRule()`.

## Adding a Convention

1. Create `src/conventions/definitions/{name}.ts` — export a `ConventionConfig` with `id`, `name`, `description`, `category`, `dealConstraints`, `biddingRules`, `examples`
2. Use `conditionedRule()` from `core/conditions` for all bidding rules — compose from existing condition factories
3. Add `registerConvention({name}Config)` call in `index.ts`
4. Create `src/conventions/__tests__/{name}/` with `rules.test.ts` and `edge-cases.test.ts`. Import shared helpers from `../fixtures` and `../tree-test-helpers`.
5. Test deal constraints with `checkConstraints()` — verify both acceptance and rejection
6. Test bidding rules with `evaluateBiddingRules()` — verify rule matching, call output, and `conditionResults`

## Test Organization

```
__tests__/
  ├── {convention}/          Per-convention test folders
  │   ├── rules.test.ts      Core bidding rules + deal constraints
  │   └── edge-cases.test.ts Interference, boundaries, unusual shapes
  ├── sayc/                  SAYC split by position (large convention)
  │   ├── helpers.ts         Shared makeBiddingContext + callFromRules
  │   ├── drillability.test.ts  Drill config + UI visibility tests
  │   ├── opening.test.ts    Opening bids + edge cases
  │   ├── responses.test.ts  Responses to suit + NT openings
  │   ├── rebids.test.ts     Opener rebids after various responses
  │   ├── competitive.test.ts  Overcalls + competitive bids
  │   ├── disjoint.test.ts   Rule overlap + reachability checks
  │   └── edge-cases.test.ts Edge cases + boundary conditions
  ├── infrastructure/        Shared engine primitives
  │   ├── rule-tree.test.ts, tree-compat.test.ts, registry*.test.ts
  │   ├── sibling-finder.test.ts  Sibling alternative unit + integration tests
  │   ├── conditions.test.ts, debug-utils.test.ts
  ├── cross-convention.test.ts  Multi-convention interaction tests
  ├── fixtures.ts            Shared helpers (hand, auctionFromBids, makeBiddingContext)
  ├── tree-test-helpers.ts   Tree evaluation test utilities
  └── _convention-template.test.ts  Template for new conventions
```

## Tree System

**Why Rule Trees?** The flat `conditionedRule()` system had 11 gaps. Most critically: (1) interference blindness — rules assumed uncontested auctions; (2) no negative inference — flat condition lists can't express "this convention path was rejected, so these hand constraints DON'T apply." Rule trees were chosen because tree path rejection data is the only architecture that enables negative inference.

**Tree Authoring Rules:**
- Auction checks = parent DecisionNodes, hand checks = child DecisionNodes (auction narrows first, then hand evaluates)
- DecisionNode names: descriptive kebab-case slugs (e.g., `is-responder`, `has-4-card-major`)
- FallbackNode = "convention doesn't apply to this hand/auction"; BidNode = "convention fires with this call"
- Strict tree constraint: do not reuse node object references across branches (breaks `flattenTree()` path accumulation)
- Use `createBiddingContext()` factory from `context-factory.ts` for all new BiddingContext construction
- `biddingRules` is optional on tree conventions — use `getConventionRules(id)` from registry for flattened rules
- `flattenTree()` splits accumulated conditions: pure auction conditions → `auctionConditions`, hand conditions → `handConditions`
- `auctionMatches()` uses exact match (via `auctionMatchesExact()`), not prefix. `["1NT", "P"]` does NOT match when auction is `["1NT", "P", "2C", "P"]`. This is why chaining rounds off the NO branch works — longer auctions fall through to later checks.
- Multiple BidNodes may share the same name (e.g., `dont-advance-pass` × 3). This is safe for all consumers (registry, inference, CLI, RulesPanel).

**SAYC tree pattern:** SAYC uses `saycPass()` factory at terminal positions (catch-all convention). Other conventions use `fallback()` for "doesn't apply."

**BidNode `meaning` field:** Every BidNode has a required `meaning: string` — a self-contained sentence fragment starting with an action verb (e.g., "Asks for a 4-card major", "Shows 4+ hearts"). Top-level on BidNode (not in optional `NodeMetadata`) so the compiler enforces completeness. `bid()` builder signature: `bid(name, meaning, callFn, metadata?)`. Phrasing rules: (1) start with action verb, (2) describe what the bid communicates to partner, (3) no convention name, (4) no HCP numbers or strength adjectives, (5) under ~15 words. Suit shape/distribution IS allowed. Threaded through pipeline: `BidNode.meaning` → `BiddingRuleResult.meaning` → `BidResult.meaning` → `BidHistoryEntry.meaning`.

**Sibling alternatives:** `findSiblingBids(tree, matched, context)` in `sibling-finder.ts` finds other BidNodes reachable in the same auction context. Walks auction conditions to find the hand subtree root, then explores all branches. Each `SiblingBid` has `bidName`, `meaning`, `call`, and `failedConditions` (hand conditions where actual result doesn't match the required branch direction). Branch-aware: tracks `{ condition, requiredResult }` pairs so conditions on the NO branch that pass are correctly reported as failed. **Invariant:** auction conditions must all precede hand conditions — interleaving throws. Wired into `mapTreeEvalResult()` in strategy/ with try/catch for production safety → `TreeEvalSummary.siblings`.

## Gotchas

- `clearRegistry()` must be called in `beforeEach` for test isolation — conventions auto-register on import
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- DONT/Landy base dealer is East but `allowedDealers: [East, West]` enables random dealer — drill rotates constraints 180° when West is chosen
- Bergen Raises variant is Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Conventions with `internal: true` are filtered from the UI by `filterConventions()` in `src/display/filter-conventions.ts` (currently no conventions use this)

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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-25 | version=7 | dir-commits-at-audit=27 | tree-sig=dirs:12,files:51,exts:ts:50,md:1 -->
