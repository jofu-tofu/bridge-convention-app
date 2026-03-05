# Conventions Core

Stable infrastructure for the convention system: registry, evaluator, protocol engine, dialogue state, intent system, tree system, overlay system, candidate pipeline.

## Module Graph

```
core/
  index.ts              Barrel re-export — optional convenience, deep imports still work
  types.ts              ConventionConfig, ConventionLookup, BiddingContext, RuleCondition, BiddingRuleResult
  conditions/           Split subsystem: auction-conditions, hand-conditions, rule-builders
  conditions.ts         Barrel re-export
  condition-evaluator.ts  evaluateConditions, buildExplanation
  rule-tree.ts          RuleNode, DecisionNode, HandDecisionNode, IntentNode (re-exported), builders
  tree-evaluator.ts     evaluateTree → TreeEvalResult (hand subtrees within protocols)
  protocol.ts           ConventionProtocol, ProtocolRound, SemanticTrigger, builders
  protocol-evaluator.ts evaluateProtocol, computeRole — protocol dispatch engine
  inference-api.ts      evaluateForInference() + inference DTOs for inference/; re-exports createBiddingContext + isAuctionCondition
  tree-compat.ts        flattenTree, flattenProtocol — compat adapters
  sibling-finder.ts     findSiblingBids, findCandidateBids — display/teaching path
  candidate-builder.ts  IntentNode → CandidateBid DTO
  intent-collector.ts   collectIntentProposals — production decision path
  candidate-generator.ts  generateCandidates → ResolvedCandidate[], applies overlay patches
  candidate-selector.ts selectMatchedCandidate — tiered selection
  effective-context.ts  EffectiveConventionContext, buildEffectiveContext(raw, config, proto, belief?, lookupConvention?)
  interference-classifier.ts  classifyInterference() — DI-based, breaks registry↔effective-context cycle
  overlay.ts            ConventionOverlayPatch, validateOverlayPatches, collectTriggerOverrides
  overlay-tree-replacement.ts  applyOverlayTreeReplacement() — shared by registry + candidate-generator
  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  registry.ts           registerConvention, getConvention, evaluateBiddingRules(context, config, lookupConvention?), computeTriggerOverridesForConfig(@internal), applyProtocolOverlays(@internal)
  diagnostics.ts        analyzeConvention, getDiagnostics — registration-time checks
  dialogue/             DialogueState, transitions, manager, baseline rules
  intent/               SemanticIntent, IntentNode, intentBid builder, resolver
```

## Protocol System

All conventions use `ConventionProtocol` — dispatch via `protocol()` + `round()` + `semantic()` builders. The evaluator (`protocol-evaluator.ts`) walks rounds sequentially, tests trigger conditions, and delegates to hand subtrees via `evaluateTree()`.

**Protocol structure:** Each `ProtocolRound` has `triggers` (AuctionConditions like `bidMade`, `partnerBidMade`), a `handTree` (static or function receiving `EstablishedContext`), and optional `seatFilter` (AuctionCondition evaluated against the FULL context).

**Multi-round with seatFilter:** Stayman (3 rounds), Bergen (4 rounds), Weak Twos (3 rounds), Lebensohl Lite use multi-round protocols. The evaluator advances the cursor for every matched round but only sets `activeRound` when seatFilter passes — separates WHAT happened from WHO acts.

**seatFilter patterns:**
- `isResponder()` / `isOpener()` — partnership role
- `not(seatHasActed())` — seat hasn't bid yet
- `biddingRound(n)` — disambiguates rebids
- `passedAfter(level, strain)` — interference protection
- Combine with `and()`, `not()`, cast as `AuctionCondition`

**Milestone conditions:** `bidMade(level, strain)`, `doubleMade()` — seat-agnostic. `partnerBidMade(level, strain)`, `opponentBidMade(level, strain)` — actor-aware via `areSamePartnership()`.

**Single-round:** SAYC uses single-round dispatch with semantic conditions.

**`ctx.seat` is fixed throughout evaluation.** seatFilter checks the evaluating seat's role in the FULL auction. Cursor-relative conditions would see the wrong partner in cross-partnership rounds.

## Dialogue State

`DialogueState` (`dialogue/`) is protocol memory — what the auction means, independent of any hand. Tracks: `familyId`, `forcingState`, `agreedStrain`, `pendingAction`, `competitionMode`, `captain`, `systemMode`, optional `systemCapabilities`, and `conventionData`. Built by replaying the auction through `TransitionRule[]` (first-match-wins). Deterministic.

**Key types:**
- `TransitionRule` — `{ id, matches(state, entry, auction, entryIndex), effects(state, entry, auction, entryIndex) }` where `entry: AuctionEntry` bundles `{ call, seat }`
- `DialogueEffect` — typed `set*` prefix fields (e.g., `setFamilyId`, `mergeConventionData`)
- `ResolverResult` — discriminated union: `resolved` (with calls), `use_default`, `declined` (excludes candidate)
- `IntentResolverFn` → `ResolverResult`. `resolveIntent()` returns `ResolverResult | null` (null = no resolver)

**Two-pass mode:** Convention `transitionRules` fire first-match-wins, then `baselineRules` backfill untouched fields. Registration validates no rule ID in both arrays.

**Actor-aware helpers** (`dialogue/helpers.ts`): `partnerOfOpener(state, seat)`, `isOpenerSeat(state, seat)` — prevent opponent bids from triggering partnership effects.

**Per-capability SystemMode:** `systemCapabilities?: Record<string, SystemMode>` overrides global `systemMode`. `getSystemModeFor(state, capability)` checks capabilities first, falls back to global. Conventions define capability constants in `constants.ts` (not `index.ts`, avoids circular deps).

## Intent System

`IntentNode` (`intent/`) is the only tree leaf type — carries `SemanticIntent` + `defaultCall`. Downstream consumers (flatten, sibling finder, inference) use `defaultCall` only. Only `conventionToStrategy()` calls the resolver.

**`createIntentBidFactory(prefix)`** generates deterministic `prefix/name` nodeIds. Duplicates within a factory throw at construction. Stayman/Bergen/Weak Twos use factories; SAYC/Lebensohl Lite use deprecated `intentBid()` (counter-based).

**IntentNode `meaning` field:** Self-contained sentence fragment starting with action verb (e.g., "Asks for a 4-card major"). No convention name, no HCP numbers. Under ~15 words.

## Tree System

**Tree authoring rules:**
- `handDecision()` for binary hand evaluation (preserves negative inference via `rejectedDecisions`)
- `and()`/`or()` throw on mixed auction+hand conditions
- `validateTree()` at registration — auction conditions after hand conditions throw
- Prefer nested decisions over compound `and()` with mixed categories
- No reusing node object references across branches (breaks `flattenTree()`)

**Sibling finder:** `findSiblingBids(tree, matched, context)` walks auction conditions to find hand subtree root, explores all branches. Each `SiblingBid` has `failedConditions` (branch-aware). Invariant: auction conditions must precede hand conditions.

**Candidate pipeline:** `collectIntentProposals()` → `generateCandidates()` → `selectMatchedCandidate()`. Selection tiers: matched+legal > preferred+legal+satisfiable > alternative+legal+satisfiable > null. Pass excluded when `forcingState` active.

**Teaching metadata:** `DecisionMetadata` on DecisionNodes, `BidMetadata` on IntentNodes, `ConventionExplanations` per convention, `ConventionTeaching` on config. `RuleCondition.teachingNote` for per-condition overrides. `negatable?: boolean` controls inference inversion.

## Overlay System

`ConventionOverlayPatch` in `overlay.ts` — patches on protocol rounds for interference/competition.

**Each patch has:** `id`, `roundName` (must match protocol round), `matches(state)` predicate, optional `priority` (lower = higher precedence), and hooks:
- `replacementTree?` — full tree replacement
- `suppressIntent?(intent, ctx)` — remove intents (return true to suppress)
- `addIntents?(ctx)` — inject intents not in the tree (no `sourceNode`, never matched)
- `overrideResolver?(intent, ctx)` — override resolver (return `Call` to override, null to fallthrough)

**Application order in `generateCandidates()`:** (1) first `replacementTree` wins, (2) all `suppressIntent` compose, (3) all `addIntents` concatenate, (4) first non-null `overrideResolver` wins. Hook errors → `onOverlayError` callback, graceful degradation.

**Validation:** `validateOverlayPatches()` checks `roundName`, `replacementTree` structure, and `triggerOverrides` keys against protocol round names. Called at registration time.

**Two consumers:** `generateCandidates()` applies hooks; `evaluateBiddingRules()` in registry applies replacement trees by re-evaluating the protocol.

## Inference API

`inference-api.ts` is the narrow bridge from core protocol internals to `src/inference/`.

- `evaluateForInference(config, context)` returns only what inference needs: flattened conditioned rules + rejected decisions
- DTO boundary avoids inference importing `flattenProtocol`, `evaluateProtocol`, and other deep core modules directly
- `createBiddingContext` and `isAuctionCondition` are re-exported here for inference callers

## Registry Pipeline Helpers

`evaluateBiddingRules()` remains the stable entrypoint. Two extracted helpers are exported for unit testing and marked `@internal`:

- `computeTriggerOverridesForConfig(config, auction)` — dialogue state + overlay trigger override stage
- `applyProtocolOverlays(config, context, protoResult, lookupConvention?)` — overlay replacement-tree stage

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope.

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it.

**Staleness anchor:** This file assumes `core/registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-03 | version=1 | dir-commits-at-audit=52 -->
