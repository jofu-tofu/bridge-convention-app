# Conventions

Convention definitions for bridge bidding practice. Each convention is a self-contained module with deal constraints, bidding rules, and examples.

## Conventions

- **Registry pattern.** All conventions register via `registerConvention()` in `core/registry.ts`. Never hardcode convention logic in switch statements.
- **One folder per convention.** Each convention in `definitions/` is a folder with `tree.ts`, `config.ts`, `explanations.ts`, `index.ts` (and optionally `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`). See `definitions/stayman/` as the reference implementation.
- **Core vs definitions split.** `core/` contains stable infrastructure (registry, evaluator, tree system, conditions). `definitions/` contains convention folders that grow unboundedly. When `definitions/` exceeds ~20 folders, introduce category subdirectories (responses/, competitive/, slam/, etc.).
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`. Importing `conventions/index` activates all conventions.
- **Rule name strings are public contract.** Rule names (e.g., `stayman-ask`, `stayman-response-hearts`) appear in CLI JSON output and are used in tests. Renaming a rule name is a breaking change.
- **`evaluateBiddingRules(context, config)` dispatches protocol only.** Takes `BiddingContext` and `ConventionConfig`. All conventions use `ConventionProtocol`; throws if no protocol is set. After protocol evaluation, applies active overlay (if any) by re-evaluating with the overlay's hand tree.

## Architecture

**Module graph:**

```
core/
  types.ts (ConventionConfig, ConventionTeaching, BiddingRule, BiddingContext, RuleCondition, AuctionCondition, HandCondition, ConditionedBiddingRule)
    ↑
  conditions/ (split subsystem: auction-conditions, hand-conditions, rule-builders)
  conditions.ts (barrel re-export for backward compat)
  condition-evaluator.ts (evaluateConditions, buildExplanation, isConditionedRule)
  rule-tree.ts (RuleNode, DecisionNode, HandDecisionNode, HandNode, FallbackNode, DecisionMetadata, BidMetadata, ConventionExplanations, builder helpers: handDecision, decision, fallback, validateTree. IntentNode re-exported from intent/)
  tree-evaluator.ts (evaluateTree, TreeEvalResult, PathEntry)
  protocol.ts (ConventionProtocol, ProtocolRound, SemanticTrigger, EstablishedContext, ProtocolEvalResult, builders: protocol, round, semantic, validateProtocol)
  protocol-evaluator.ts (evaluateProtocol, computeRole — protocol dispatch engine)
  tree-compat.ts (flattenTree, flattenProtocol, treeResultToBiddingRuleResult — compat adapters)
  sibling-finder.ts (findSiblingBids, findCandidateBids — sibling bids + enriched candidates for display/teaching)
  candidate-builder.ts (toCandidateBid — IntentNode → CandidateBid DTO)
  intent-collector.ts (collectIntentProposals — traverses hand subtree, gathers CollectedIntent proposals with pathConditions. Production decision path.)
  candidate-generator.ts (generateCandidates — resolves CollectedIntent proposals through intent system → ResolvedCandidate[], applies overlay patches including suppressIntent/addIntents/overrideResolver hooks)
  candidate-selector.ts (selectMatchedCandidate — picks matched candidate's resolved call from ResolvedCandidate[])
  effective-context.ts (EffectiveConventionContext — bundles raw context + config + protocol result + dialogue state + active overlay + optional BeliefData. buildEffectiveContext() factory)
  overlay.ts (ConventionOverlayPatch type, validateOverlayPatches, collectTriggerOverrides — overlay patches for interference/competition with optional hooks: suppressIntent, addIntents, overrideResolver, triggerOverrides)
  context-factory.ts (createBiddingContext — canonical BiddingContext constructor)
    ↑
  registry.ts (registerConvention, getConvention, evaluateBiddingRules — dispatches protocol conventions)
    ↑
definitions/
  stayman/ (staymanConfig, staymanDealConstraints, staymanOverlays — interference via overlays)
  bergen-raises/ (bergenConfig, bergenDealConstraints)
  sayc/ (saycConfig — user-drillable, South 10+ HCP)
  weak-twos/ (weakTwosConfig — preemptive opening + Ogust)
  ↑
index.ts (auto-registration entry point)
```

**Key core files:** `types.ts` (all interfaces, ConventionConfig with optional `transitionRules`/`intentResolvers`/`overlays`), `conditions/` (split subsystem: auction/hand/rule-builders), `condition-evaluator.ts` (evaluate + explain), `rule-tree.ts` (RuleNode = DecisionNode | IntentNode | FallbackNode, HandNode = HandDecisionNode | IntentNode | FallbackNode, builders: decision, handDecision, fallback, validateTree), `protocol.ts` (protocol types + builders), `protocol-evaluator.ts` (protocol dispatch), `tree-evaluator.ts` (evaluateTree for hand subtrees, IntentNode is only leaf type), `tree-compat.ts` (flattenTree/flattenProtocol + result adapter, IntentNode uses defaultCall), `sibling-finder.ts` (sibling alternatives for display/teaching, IntentNode uses defaultCall), `intent-collector.ts` (collectIntentProposals — production decision path, gathers CollectedIntent with pathConditions), `overlay.ts` (ConventionOverlayPatch type, validateOverlayPatches, optional hooks), `candidate-selector.ts` (selectMatchedCandidate), `dialogue/` (DialogueState, transitions, manager, baseline rules), `intent/` (SemanticIntent, IntentNode, intentBid builder, resolver), `context-factory.ts` (createBiddingContext), `registry.ts` (convention map + protocol dispatch + overlay application).

**Definitions:** 4 convention folders (stayman, bergen-raises, sayc, weak-twos). Each folder has `tree.ts`, `config.ts`, `explanations.ts`, `index.ts` (optionally `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`). `index.ts` auto-registers all.

## Convention Rules Reference

Per-convention rule details (deal constraints, rule names, priority order, HCP ranges): see `docs/conventions/` and the definition files in `definitions/`. Key facts for quick orientation:

- **Stayman:** Responds to NT openings. Includes Smolen + 2NT Stayman at 3-level. Multi-round protocol with interference handling via overlays (`stayman/overlays.ts`: `stayman-doubled` for doubled+modified, `stayman-overcalled` for overcalled+system-off).
- **Bergen Raises:** Multi-round framework (constructive/limit/preemptive + opener rebids + game try continuations). Standard Bergen variant.
- **SAYC:** User-drillable, also E/W opponent AI default. 55+ flattened rules covering openings (1-level suit/NT, 2C strong, 2NT, weak twos, 3-level preempts), responses (Jacoby transfers, Stayman, 2C/2NT/weak-two responses), rebids (transfer acceptance), competitive. All IntentNode leaves with empty resolvers (deterministic via defaultCall).
- **Weak Twos:** Preemptive opening (2D/2H/2S with 6+ suit, 5-11 HCP), Ogust response system, vulnerability awareness.

**Bridge rules sources:** See `docs/bridge-rules-sources.md` for authoritative references and ambiguity resolution.

## Conditioned Rules

- **`conditionedRule()` factory mandate.** All new rules MUST use `conditionedRule()` from `conditions.ts`. Never hand-build a `ConditionedBiddingRule` object (risks split-brain between `matches()` and `conditions[]`).
- **Auction/hand condition split.** `conditionedRule()` requires explicit `auctionConditions` and `handConditions` arrays (both required, use `[]` if empty). The flattened `.conditions` getter provides backward compat for `evaluateConditions()` and `buildExplanation()`.
- **Hybrid conditions belong in `handConditions`.** Conditions like `majorSupport()`, `advanceSupportFor()`, `partnerRaisedToThreeOfMajor()` that check auction state to resolve parameters but ultimately gate on hand properties belong in `handConditions`, not `auctionConditions`. The inference engine iterates only `handConditions` for `.inference` metadata.
- **Auction conditions must NOT carry `.inference` metadata** — enforced by test in `conditions.test.ts`.
- **`or()` always-evaluate invariant.** `or()` MUST evaluate all branches unconditionally — short-circuiting breaks the UI branch-highlighting feature. Max 4 branches, nesting depth ≤ 2.
- **Imperative escape hatch.** A rule MAY stay as plain `BiddingRule` (with static `explanation`) if the declarative model cannot express its logic. All rules across 5 conventions use `conditionedRule()`. New conventions should use `conditionedRule()`.

## Adding a Convention

1. Create `src/conventions/definitions/{name}/` folder with `tree.ts` (protocol + hand subtrees), `config.ts` (deal constraints + convention config with `protocol` field), `explanations.ts` (teaching metadata scaffold), `index.ts` (barrel exports). Optionally add `helpers.ts` (dynamic call functions) and `conditions.ts` (local RuleCondition factories).
2. Build a `ConventionProtocol` using `protocol()`, `round()`, `semantic()` from `core/protocol`. Use hand subtree nodes (`handDecision`, `intentBid`, `fallback`) from `core/rule-tree` and `core/intent/`. Compose conditions from existing factories in `core/conditions`.
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
  │   ├── rule-builders.test.ts  and()/or() category derivation + mixed-condition rejection
  │   ├── tree-validation.test.ts  validateTree() auction-before-hand invariant
  │   ├── conditions.test.ts, debug-utils.test.ts
  ├── cross-convention.test.ts  Multi-convention interaction tests
  ├── fixtures.ts            Shared helpers (hand, auctionFromBids, makeBiddingContext)
  ├── tree-test-helpers.ts   Tree evaluation test utilities
  └── _convention-template.test.ts  Template for new conventions
```

## Protocol System

**All conventions use `ConventionProtocol`.** Convention dispatch uses `protocol()` + `round()` + `semantic()` builders from `core/protocol.ts`. The evaluator in `core/protocol-evaluator.ts` walks rounds sequentially, tests trigger conditions, and delegates to hand subtrees via `evaluateTree()`.

**Protocol structure:** Each convention has a `ConventionProtocol` with one or more `ProtocolRound`s. Each round has `triggers` (semantic conditions), a `handTree` (static or function returning `HandNode`), and an optional `seatFilter` (AuctionCondition evaluated against the FULL context). Triggers are `AuctionCondition`s (e.g., `bidMade`, `bidMadeAtLevel`, `isOpener`, `auctionMatches`). The `handTree` function receives accumulated `EstablishedContext` from matched triggers.

**Multi-round protocols with seatFilter:** Stayman (3 rounds), Bergen (4 rounds), Weak Twos (3 rounds), and Michaels (3 rounds) use multi-round protocols. Each round has a `seatFilter` that determines which seat acts in that round. The evaluator advances the cursor for every matched round but only sets `activeRound` when the seatFilter passes. This separates WHAT happened (triggers) from WHO acts (seatFilter).

**seatFilter mechanism:** `ProtocolRound.seatFilter` is an optional `AuctionCondition` evaluated against the FULL context (not cursor-windowed). If present and fails, cursor advances (the milestone happened) but `activeRound` is NOT updated. Common seatFilter patterns:
- `isResponder()` / `isOpener()` — partnership role
- `not(seatHasActed())` — seat hasn't bid/passed yet (for advancer/responder first action)
- `seatHasBid()` — seat has previously made a contract bid
- `biddingRound(n)` — seat has made exactly n prior bids (disambiguates rebids)
- `passedAfter(level, strain)` — interference protection: checks pass follows specific bid
- Combine with `and()`, `not()`, cast result `as AuctionCondition`

**Milestone condition factories:** `bidMade(level, strain)`, `doubleMade()`, `bidMadeAtLevel(level)` — seat-agnostic conditions that detect WHAT happened in the auction. Used as triggers. `partnerBidMade(level, strain)`, `opponentBidMade(level, strain)` — actor-aware variants using `areSamePartnership()` to check WHO made the bid. Stayman uses `partnerBidMade` for NT opening triggers. `passedAfter(level, strain)`, `passedAfterDouble()` — used in seatFilters for interference protection.

**Single-round conventions:** SAYC (4 triggers) uses single-round dispatch with `auctionMatches` or semantic conditions.

**`ctx.seat` is fixed throughout evaluation.** The evaluating seat never changes between rounds. This is why seatFilter works correctly — it checks the evaluating seat's role in the FULL auction. Cursor-relative conditions like `lastPartnerBid()` would see the wrong partner in cross-partnership rounds, so triggers use seat-agnostic milestones instead.

**Protocol required:** `ConventionConfig` must have `protocol` set. `evaluateBiddingRules()` throws if no protocol is present.

## Dialogue State + Intent System (Stayman/Weak Twos/Bergen migrated)

**DialogueState** (`core/dialogue/`) is protocol memory — what the auction means under the partnership agreement, independent of any hand. It tracks: `familyId` (e.g., "1nt"), `forcingState`, `agreedStrain`, `pendingAction`, `competitionMode`, `captain`, `systemMode`, and convention-specific `conventionData`. Built by replaying the auction through `TransitionRule` arrays (first-match-wins). Deterministic: same inputs → same output.

**IntentNode** (`core/intent/`) is the only tree leaf type — carries semantic intent + `defaultCall`. All downstream consumers (flatten, sibling finder, inference) use `defaultCall` and are UNAWARE of the intent layer. Only `conventionToStrategy()` calls the resolver. `HandNode` union: `HandDecisionNode | IntentNode | FallbackNode`.

**Key types:**
- `DialogueState` — immutable state object replayed from auction
- `TransitionRule` — `{ id, matches(), effects() }` tested in order, first-match-wins
- `DialogueEffect` — typed update with `set*` prefix fields (e.g., `setFamilyId`, `setSystemMode`, `mergeConventionData`). `activateOverlay` accepted but ignored (future seam). Prevents accidental pass-through of DialogueState as effect.
- `IntentNode` — `{ type: "intent", nodeId, name, meaning, intent, defaultCall, metadata?, alert? }` (`nodeId` auto-assigned by `intentBid()` builder)
- `SemanticIntent` — `{ type: SemanticIntentType, params }` (not a fixed universe)
- `ResolvedIntent` — `{ call: Call }` (no effect field — DialogueState is replay-based)
- `ResolverResult` — discriminated union: `{ status: "resolved", calls: ResolvedIntent[] }` | `{ status: "use_default" }` | `{ status: "declined" }`. "declined" excludes the candidate entirely (not a fallback to defaultCall). Do not use null to mean "declined intent" — use `{ status: "declined" }` explicitly.
- `IntentResolverFn` — returns `ResolverResult`. `resolveIntent()` returns `ResolverResult | null` (null = no resolver registered → use defaultCall).
- `IntentResolverMap` — `ReadonlyMap<string, IntentResolverFn>` (plain data, no global state)

**Convention config fields:** `transitionRules?: readonly TransitionRule[]`, `baselineRules?: readonly TransitionRule[]`, `intentResolvers?: IntentResolverMap`, and `overlays?: readonly ConventionOverlayPatch[]` — explicit data on ConventionConfig, not global registries. `transitionRules` and `intentResolvers` required when hand trees contain IntentNode leaves. `overlays` optional — for interference/competition tree replacement. **Two-pass mode:** When `baselineRules` is set, `computeDialogueState` runs convention rules first (first-match-wins), then baseline rules but only sets fields the convention rule didn't touch (backfill). Convention values always win. All 4 conventions use two-pass mode. When `baselineRules` is not set, falls back to single-pass with the flat `transitionRules` array. Registration validates no rule ID appears in both arrays.

**File locations:**
- `core/dialogue/dialogue-state.ts` — enums + DialogueState interface
- `core/dialogue/dialogue-transitions.ts` — TransitionRule, DialogueEffect, applyEffect()
- `core/dialogue/dialogue-manager.ts` — computeDialogueState()
- `core/dialogue/baseline-transitions.ts` — universal baseline rules (1NT/2NT detection, interference, pass)
- `core/intent/semantic-intent.ts` — SemanticIntentType enum + SemanticIntent
- `core/intent/intent-node.ts` — IntentNode type + intentBid() builder
- `core/intent/intent-resolver.ts` — resolveIntent(), IntentResolverFn, IntentResolverMap
- `definitions/stayman/transitions.ts` — Stayman-specific transition rules
- `definitions/stayman/resolvers.ts` — Stayman intent resolvers
- `definitions/stayman/overlays.ts` — Stayman interference overlays (doubled + overcalled)

**Migration complete:** All conventions use IntentNode leaves. BidNode type has been removed.

## Tree System

**Why Rule Trees?** The flat `conditionedRule()` system had 11 gaps. Most critically: (1) interference blindness — rules assumed uncontested auctions; (2) no negative inference — flat condition lists can't express "this convention path was rejected, so these hand constraints DON'T apply." Rule trees were chosen because tree path rejection data is the only architecture that enables negative inference.

**Tree Authoring Rules (for hand subtrees within protocols):**
- `handDecision()` for hand conditions — hand evaluation stays binary (preserves negative inference via `rejectedDecisions`).
- `intentBid()` from `core/intent/intent-node.ts` for leaf nodes — requires SemanticIntent + defaultCall.
- `and()`/`or()` throw at runtime if given mixed auction+hand conditions. All children must be same category.
- `validateTree()` runs at `registerConvention()` time — auction conditions after hand conditions on any path will throw.
- Prefer nested decisions over compound `and()` with mixed categories — each decision appears as a distinct step in `TreeEvalResult.visited`.
- DecisionNode names: descriptive kebab-case slugs (e.g., `is-responder`, `has-4-card-major`)
- FallbackNode = "convention doesn't apply to this hand/auction"; IntentNode = "convention fires with this intent/call"
- Strict tree constraint: do not reuse node object references across branches (breaks `flattenTree()` path accumulation). Use factory functions for shared subtrees.
- Use `createBiddingContext()` factory from `context-factory.ts` for all new BiddingContext construction
- `flattenTree()` splits accumulated conditions: pure auction conditions → `auctionConditions`, hand conditions → `handConditions`
- `auctionMatches()` uses exact match (via `auctionMatchesExact()`), not prefix. `["1NT", "P"]` does NOT match when auction is `["1NT", "P", "2C", "P"]`.
- Multiple IntentNodes may share the same name. This is safe for all consumers (registry, inference, CLI, RulesPanel).

**Protocol trigger ordering:** Pattern-based triggers (`auctionMatches`) are mutually exclusive (exact match). Semantic triggers (`isOpener`, `isResponder`) are order-dependent — first-match-wins. `validateProtocol()` ensures all triggers have `category === "auction"`.

**Hand evaluation stays binary.** Hand decisions are genuinely binary discriminations ("8+ HCP?" yes/no, "4+ hearts?" yes/no). The NO branch encodes negative inference — the inference engine reads `rejectedDecisions` from `TreeEvalResult`. Multi-way hand branching would lose this structural negation. The "multi-way" display for hand options is handled by the sibling finder.

**SAYC tree pattern:** SAYC uses `saycPass()` factory at terminal positions (catch-all convention). Other conventions use `fallback()` for "doesn't apply."

**IntentNode `meaning` field:** Every IntentNode has a required `meaning: string` — a self-contained sentence fragment starting with an action verb (e.g., "Asks for a 4-card major", "Shows 4+ hearts"). Phrasing rules: (1) start with action verb, (2) describe what the bid communicates to partner, (3) no convention name, (4) no HCP numbers or strength adjectives, (5) under ~15 words. Suit shape/distribution IS allowed. Threaded through pipeline: `IntentNode.meaning` → `BiddingRuleResult.meaning` → `BidResult.meaning` → `BidHistoryEntry.meaning`.

**Teaching metadata:** `DecisionMetadata` (whyThisMatters, commonMistake, denialImplication) on DecisionNodes, `BidMetadata` (whyThisBid, partnerExpects, isArtificial, forcingType, commonMistake) on IntentNodes. `ConventionExplanations` in each convention's `explanations.ts` maps node names to metadata + provides convention-specific condition explanations. `ConventionTeaching` on `ConventionConfig.teaching` for convention-level purpose/whenToUse/tradeoff. `RuleCondition.teachingNote` for per-condition overrides. `RuleCondition.negatable?: boolean` — defaults to true; set to false for conditions where the NO branch doesn't imply a clean inverse (e.g., `isBalanced()` where NOT balanced ≠ unbalanced). Inference's `shouldInvertCondition()` checks this before calling `invertInference()`. Stayman is fully populated; other conventions have empty scaffolds.

**Sibling alternatives:** `findSiblingBids(tree, matched, context)` in `sibling-finder.ts` finds other IntentNodes reachable in the same auction context. Walks auction conditions to find the hand subtree root, then explores all branches. Each `SiblingBid` has `bidName`, `meaning`, `call`, and `failedConditions` (hand conditions where actual result doesn't match the required branch direction). Branch-aware: tracks `{ condition, requiredResult }` pairs so conditions on the NO branch that pass are correctly reported as failed. **Invariant:** auction conditions must all precede hand conditions — interleaving throws. Wired into `mapTreeEvalResult()` in strategy/ with try/catch for production safety → `TreeEvalSummary.siblings`.

**CandidateBid:** `findCandidateBids(tree, matched, context, conventionId, roundName?)` in `sibling-finder.ts` enriches sibling bids with `intent` (type + params) and `source` (conventionId, roundName, nodeName) metadata. `CandidateBid extends SiblingBid` in `shared/types.ts`. Builder in `candidate-builder.ts`. Wired into `mapTreeEvalResult()` → `TreeEvalSummary.candidates`.

**Intent collector:** `collectIntentProposals(handTreeRoot, context)` in `intent-collector.ts` traverses a hand subtree and gathers all `CollectedIntent` proposals. Each has `intent`, `nodeName`, `meaning`, `defaultCall`, `pathConditions` (hand conditions with branch direction), and optional `sourceNode` (original IntentNode reference). Tree-collected intents have `sourceNode` set; overlay-injected intents (from `addIntents()`) do not. Matching uses `nodeId` comparison (`proposal.sourceNode.nodeId === matched.nodeId`).

**ResolvedCandidate:** `generateCandidates(handTreeRoot, handResult, effectiveCtx)` in `candidate-generator.ts` resolves `CollectedIntent` proposals through the intent system. Returns `CandidateGenerationResult { candidates: ResolvedCandidate[], matchedIntentSuppressed: boolean }`. `ResolvedCandidate extends CandidateBid` with `resolvedCall`, `isDefaultCall`, `legal`, `isMatched`. Uses `collectIntentProposals()` for traversal — decoupled from display/teaching path. Applies overlay patch hooks (suppress, add, override). Matched node first, then others. `matchedIntentSuppressed` tracks whether `suppressIntent` specifically removed the matched intent's proposal. Error handling: resolver throws → falls back to defaultCall. Wired into `conventionToStrategy()` via `selectMatchedCandidate()`.

**Candidate selection:** `selectMatchedCandidate(candidates, ranker?)` in `candidate-selector.ts` — tiered selection: Tier 1 matched+legal, Tier 2 preferred+legal, Tier 3 alternative+legal, Tier 4 null. Optional ranker reorders within tiers. Wired into `conventionToStrategy()`.

## Overlay System

**ConventionOverlayPatch** (`core/overlay.ts`) enables interference/competition handling via patches on protocol rounds. Each patch has: `id` (unique string), `roundName` (must match a protocol round name), `matches(state: DialogueState): boolean` (predicate on dialogue state), and optional hooks:
- `replacementTree?` — full tree replacement (backward compat, renamed from `handTree`)
- `suppressIntent?(intent, ctx)` — remove specific intents from candidate list (return true to suppress)
- `addIntents?(ctx)` — add intents not in the tree (returned intents have no `sourceNode`, never matched)
- `overrideResolver?(intent, ctx)` — override standard resolver (return `Call` to override, `null` to fallthrough)

**Hook application order** in `generateCandidates()`: (1) `replacementTree` if set, (2) `suppressIntent` filters, (3) `addIntents` appends, (4) `overrideResolver` before standard resolver. Hook errors → `onOverlayError` callback if provided, else `console.warn`. Graceful degradation.

**Overlay resolution:** `buildEffectiveContext()` in `effective-context.ts` resolves active overlays — filters config overlays by `roundName` matching the active protocol round and `matches()` returning true for the computed dialogue state. All matching overlays are collected into `activeOverlays: readonly ConventionOverlayPatch[]` on `EffectiveConventionContext`.

**Overlay application:** Two consumers apply overlays:
1. `generateCandidates()` — iterates `effectiveCtx.activeOverlays`: first `replacementTree` wins, `suppressIntent` from ALL overlays compose, `addIntents` from ALL overlays concatenate, `overrideResolver` first non-null wins.
2. `evaluateBiddingRules()` in `registry.ts` — after protocol evaluation, checks if an active overlay exists via `buildEffectiveContext()`, and if so re-evaluates with the overlay's replacement tree, updating the protocol result.

**Overlay validation:** `validateOverlayPatches(overlays, protocol)` in `overlay.ts` checks that each overlay's `roundName` matches a round in the protocol. Called by `registerConvention()` at registration time — invalid round names throw immediately.

**Stayman overlays** (`definitions/stayman/overlays.ts`): Two overlay patches — `stayman-doubled` (matches `CompetitionMode.Doubled + SystemMode.Modified`, provides contested tree with redouble/escape/competitive pass) and `stayman-overcalled` (matches non-uncontested + `SystemMode.Off`, system off fallback). `round1AskAfterDouble` exported from `stayman/tree.ts`.

**Event classifier:** `classifyAuctionEntry(entry, evaluatingSeat, auction)` in `core/dialogue/event-classifier.ts` — pure function that produces `ClassifiedEntry` with actor (self/partner/lho/rho), actionKind, bidNature, interferenceKind. Available for optional adoption by transition rules.

## Gotchas

- `clearRegistry()` must be called in `beforeEach` for test isolation — conventions auto-register on import
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-03-01 | version=10 | dir-commits-at-audit=52 | tree-sig=dirs:22,files:110,exts:ts:109,md:1 -->
