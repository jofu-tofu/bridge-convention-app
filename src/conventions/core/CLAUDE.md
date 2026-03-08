# Conventions Core

Stable infrastructure for the convention system: registry, evaluator, protocol engine, dialogue state, intent system, tree system, overlay system, candidate pipeline.

## Module Graph

```
core/
  index.ts              Public API barrel — external consumers import from here (ESLint-enforced)
  types.ts              ConventionConfig, ConventionLookup, BiddingContext, RuleCondition, BiddingRuleResult
  conditions/           Split subsystem: auction-conditions, hand-conditions, rule-builders
  conditions.ts         Barrel re-export
  condition-evaluator.ts  evaluateConditions, buildExplanation
  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  inference-api.ts      evaluateForInference() + inference DTOs for inference/; re-exports createBiddingContext + isAuctionCondition
  registry.ts           registerConvention, getConvention, evaluateBiddingRules(context, config, lookupConvention?), computeTriggerOverridesForConfig(@internal), applyProtocolOverlays(@internal)
  diagnostics.ts        analyzeConvention, getDiagnostics — registration-time checks (trigger-shadow, unreachable-node, transition-rule-overlap)
  trigger-descriptor.ts TriggerDescriptor union type, descriptorOverlaps/Subsumes/Disjoint — semantic overlap analysis
  tree/                 Tree system
    rule-tree.ts          RuleNode, DecisionNode, HandDecisionNode, IntentNode (re-exported), builders
    tree-evaluator.ts     evaluateTree → TreeEvalResult (hand subtrees within protocols)
    tree-compat.ts        flattenTree, flattenProtocol — compat adapters
    sibling-finder.ts     findSiblingBids, findCandidateBids — display/teaching path
    candidate-builder.ts  IntentNode → CandidateBid DTO
  protocol/             Protocol system
    protocol.ts           ConventionProtocol, ProtocolRound, SemanticTrigger, builders
    protocol-evaluator.ts evaluateProtocol — protocol dispatch engine
  overlay/              Overlay system
    overlay.ts            ConventionOverlayPatch, validateOverlayPatches, collectTriggerOverrides
    overlay-tree-replacement.ts  applyOverlayTreeReplacement() — shared by registry + candidate-generator
  pipeline/             Candidate pipeline
    candidate-generator.ts  generateCandidates → ResolvedCandidate[], applies overlay patches
    candidate-selector.ts selectMatchedCandidate — tiered selection
    intent-collector.ts   collectIntentProposals — production decision path
    effective-context.ts  EffectiveConventionContext, buildEffectiveContext(raw, config, proto, belief?, lookupConvention?)
    interference-classifier.ts  classifyInterference() — DI-based, breaks registry↔effective-context cycle
  dialogue/             DialogueState, transitions, manager, baseline rules
  intent/               SemanticIntent, IntentNode, intentBid builder, resolver
```

## Convention-Universality Validation

Every subsystem here (protocol, overlay, intent, dialogue, pipeline) exists because simpler designs failed the convention-universality test. When modifying any abstraction in this directory, validate the change against all 5 conventions — not just the one motivating the change. If a change would require a convention-specific `if` branch in core infrastructure, the abstraction needs rethinking.

## Protocol System

All conventions use `ConventionProtocol` — dispatch via `protocol()` + `round()` + `semantic()` builders. The evaluator (`protocol-evaluator.ts`) walks rounds sequentially, tests trigger conditions, and delegates to hand subtrees via `evaluateTree()`.

**Protocol structure:** Each `ProtocolRound` has `triggers` (AuctionConditions like `bidMade`, `partnerBidMade`), a `handTree` (static or function receiving `EstablishedContext`), optional `seatFilter` (AuctionCondition evaluated against the FULL context), and optional `span` (how many auction entries this round's event covers; default 2).

**Variable-arity span:** Each round has `span?: number` (default 2). `span=1` for single-entry events, `span=3` for triple-entry windows, `span=0` for virtual rounds that don't advance the cursor. `MatchedRoundEntry` carries `cursorStart`/`cursorEnd` for each matched round. A span=0 loop guard breaks after 1 consecutive span=0 match to prevent infinite loops. All 5 existing conventions omit `span` (default 2 — backwards compatible).

**Event-local trigger scope:** Triggers see only the current event span (`entries.slice(cursor, cursor+span)`), not the full auction prefix. This prevents stale events from prior rounds matching later triggers. Milestone conditions (`bidMade`, `bidMadeAtLevel`, `doubleMade`, `partnerBidMade`, `opponentBidMade`) have `triggerScope: "event"`. For rounds that don't need to detect a new event (the cursor advancing is sufficient), use `cursorReached()`. `seatFilters` see the full context (unchanged).

**Architectural constraint:** Do NOT add protocol-specific fields (like `triggerSpan`) to `BiddingContext` — it is a cross-boundary DTO in `src/core/contracts/`. The evaluator-only fix keeps protocol concerns inside the protocol layer.

**Trigger vs seatFilter:** Triggers answer "what just happened in this event span"; seatFilters answer "given the full auction state, does this round apply to me." If a condition genuinely needs full auction history (e.g., `isOpener()`, `biddingRound()`), it belongs in a seatFilter, not a trigger. The `triggerScope` property on `RuleCondition` marks this distinction; diagnostics (`analyzeTriggerScope`) warn on `triggerScope: "full"` conditions used as triggers.

**Multi-round with seatFilter:** Stayman (3 rounds), Bergen (4 rounds), Weak Twos (3 rounds), Lebensohl Lite use multi-round protocols. The evaluator advances the cursor for every matched round but only sets `activeRound` when seatFilter passes — separates WHAT happened from WHO acts.

**seatFilter patterns:**
- `isResponder()` / `isOpener()` — partnership role
- `not(seatHasActed())` — seat hasn't bid yet
- `biddingRound(n)` — disambiguates rebids
- `passedAfter(level, strain)` — interference protection
- Combine with `and()`, `not()`, cast as `AuctionCondition`

**Milestone conditions:** `bidMade(level, strain)`, `doubleMade()`, `bidMadeAtLevel(level)` — seat-agnostic, `triggerScope: "event"`. `partnerBidMade(level, strain)`, `opponentBidMade(level, strain)` — actor-aware via `areSamePartnership()`, `triggerScope: "event"`. `cursorReached()` — always-true trigger for continuation rounds that rely on seatFilter for applicability.

**Single-round:** SAYC uses single-round dispatch with semantic conditions.

**`ctx.seat` is fixed throughout evaluation.** seatFilter checks the evaluating seat's role in the FULL auction. Cursor-relative conditions would see the wrong partner in cross-partnership rounds.

## Dialogue State

`DialogueState` (`dialogue/`) is protocol memory — what the auction means, independent of any hand. Tracks: `familyId`, `forcingState`, `agreedStrain`, `obligation` (`Obligation` with `ObligationKind` + `obligatedSide`), `competitionMode`, `captain`, `systemMode`, optional `systemCapabilities`, and `conventionData`. Built by replaying the auction through `TransitionRule[]` (first-match-wins). Deterministic.

**Key types:**
- `TransitionRule` — `{ id, matches(state, entry, auction, entryIndex), effects(state, entry, auction, entryIndex) }` where `entry: AuctionEntry` bundles `{ call, seat }`
- `DialogueEffect` — typed `set*` prefix fields (e.g., `setFamilyId`, `mergeConventionData`)
- `ResolverResult` — discriminated union: `resolved` (with calls), `use_default`, `declined` (kept with `protocol.satisfied=false`, filtered at selection time)
- `IntentResolverFn` → `ResolverResult`. `resolveIntent()` returns `ResolverResult | null` (null = no resolver)

**Two-pass mode:** Convention `transitionRules` fire first-match-wins, then `baselineRules` backfill untouched fields. Registration validates no rule ID in both arrays.

**Actor-aware helpers** (`dialogue/helpers.ts`): `partnerOfOpener(state, seat)`, `isOpenerSeat(state, seat)` — prevent opponent bids from triggering partnership effects. `getLocalRoles(state, seat)` derives a composite array of `LocalRole` values (`"captain"`, `"obligated-bidder"`, `"frame-owner"`, `"waiting"`, `"participant"`) from DialogueState — purely computed, no new state.

**Per-capability SystemMode:** `systemCapabilities?: Record<string, SystemMode>` overrides global `systemMode`. `getSystemModeFor(state, capability)` checks capabilities first, falls back to global. Conventions define capability constants in `constants.ts` (not `index.ts`, avoids circular deps).

## Intent System

`IntentNode` (`intent/`) is the only tree leaf type — carries `SemanticIntent` + `defaultCall`. Downstream consumers (flatten, sibling finder, inference) use `defaultCall` only. Only `conventionToStrategy()` calls the resolver.

**`createIntentBidFactory(prefix)`** generates deterministic `prefix/name` nodeIds. Duplicates within a factory throw at construction. Stayman/Bergen/Weak Twos/SAYC use factories; Lebensohl Lite uses deprecated `intentBid()` (counter-based).

**IntentNode `meaning` field:** Self-contained sentence fragment starting with action verb (e.g., "Asks for a 4-card major"). No convention name, no HCP numbers. Under ~15 words.

## Tree System

**Tree authoring rules:**
- `handDecision()` for binary hand evaluation (preserves negative inference via `rejectedDecisions`)
- `and()`/`or()` throw on mixed auction+hand conditions
- `validateTree()` at registration — auction conditions after hand conditions throw
- Prefer nested decisions over compound `and()` with mixed categories
- No reusing node object references across branches (breaks `flattenTree()`)

**Sibling finder:** `findSiblingBids(tree, matched, context)` walks auction conditions to find hand subtree root, explores all branches. Each `SiblingBid` has `failedConditions` (branch-aware) and optional `resolverContext` (`{ intentType, wasRemapped }`) populated by `enrichSiblingsWithResolvedCalls()` when the resolver remapped the call. Invariant: auction conditions must precede hand conditions.

**Candidate pipeline:** `collectIntentProposals()` → `generateCandidates()` → `selectMatchedCandidate()`. `CollectedIntent` carries `orderKey` (DFS counter) for deterministic tie-breaking. `ResolvedCandidate` carries required `orderKey`. Selection tiers: matched+legal > preferred+legal+satisfiable > alternative+legal+satisfiable > null. Within each tier, candidates sorted by `orderKey` (lower = higher priority) when no ranker applied. Overlay-injected intents get `10_000 + index`. Pass excluded when `forcingState` active. `SelectionResult` includes `preRankingPeers` (full tier set before ranking) alongside `tierPeers` (cleared when ranker applied).

**Eligibility model:** Every `ResolvedCandidate` carries a `CandidateEligibility` with four orthogonal dimensions: hand (failedConditions), protocol (suppressed/declined), encoding (legality with optional `reason`), and pedagogical (convention hook). `isSelectable(c)` checks three dimensions (hand, protocol, encoding) — pedagogical is NOT a selection gate; it's a post-selection annotation for teaching. `isPedagogicallyAcceptable(c)` is exported separately for teaching-layer consumers. `encoding.reason` distinguishes `"all_encodings_illegal"` (all resolver encodings failed) from `"illegal_in_auction"` (single call illegal). Architectural rule: eligibility is intrinsic candidate state; `allowed()` (forcing/obligation) remains a selection-time policy in the selector. Candidates array now includes protocol-ineligible candidates (suppressed/declined) — array presence does NOT mean selectability.

**Teaching metadata:** `DecisionMetadata` on DecisionNodes, `BidMetadata` on IntentNodes, `ConventionExplanations` per convention, `ConventionTeaching` on config. `RuleCondition.teachingNote` for per-condition overrides. `negatable?: boolean` controls inference inversion. `pedagogicalCheck` on `ConventionConfig` — optional hook for convention-level pedagogical eligibility (feeds the pedagogical dimension of `CandidateEligibility`). Checked via `isPedagogicallyAcceptable()` (post-selection annotation, not a selection gate).

## Overlay System

`ConventionOverlayPatch` in `overlay.ts` — patches on protocol rounds for interference/competition.

**Each patch has:** `id`, `roundName` (must match protocol round), `matches(state)` predicate, optional `priority` (lower = higher precedence), and hooks:
- `replacementTree?` — full tree replacement
- `suppressIntent?(intent, ctx)` — remove intents (return true to suppress). Suppressed proposals are tagged with `suppressedBy` and kept in the candidates array with `protocol.satisfied=false`, rather than being filtered out.
- `addIntents?(ctx)` — inject intents not in the tree (no `sourceNode`, never matched)
- `overrideResolver?(intent, ctx)` — override resolver (return `Call` to override, null to fallthrough)

**Application order in `generateCandidates()`:** (1) first `replacementTree` wins, (2) all `suppressIntent` compose, (3) all `addIntents` concatenate, (4) first non-null `overrideResolver` wins. Hook errors → `onOverlayError` callback, graceful degradation. When the tree yields no intent match (null or non-intent matched node), `addIntents` hooks still run and can rescue the empty candidate pool — tree collection and suppression are skipped, only overlay-injected candidates are produced (all with `isMatched: false`). If no overlay has `addIntents`, the result is still empty.

**Validation:** `validateOverlayPatches()` checks `roundName`, `replacementTree` structure, and `triggerOverrides` keys against protocol round names. Called at registration time.

**Two consumers:** `generateCandidates()` applies hooks; `evaluateBiddingRules()` in registry applies replacement trees by re-evaluating the protocol.

## EstablishedContext vs DialogueState

Two systems extract semantic facts from the auction. They answer different questions and must not be unified.

- **`EstablishedContext<T>`** (per-convention generic, empty marker interface) selects hand trees in protocol dispatch. Convention extensions add optional fields (like `showed`, `openingSuit`). Computed by the protocol evaluator via cursor-based windowing (span-sized per round, default 2). Only consumed by `evaluateProtocol()` for tree selection. **Do NOT add global role/position fields** — semantic role authority lives in `DialogueState` (obligation, captain, frames). Use `getLocalRoles(state, seat)` to derive local semantic roles.
- **`DialogueState`** (fixed universal schema) carries semantic meaning for downstream consumers: overlays, candidate pipeline, forcing filter, resolvers, teaching. Computed by replaying entries one-by-one through `TransitionRule[]`.

**Some facts intentionally exist in both systems:**
- Stayman: `showed` ("hearts"|"spades"|"denial") — protocol uses it to select the rebid hand tree; dialogue uses it for resolver context and overlay matching.
- Weak Twos: `openingSuit` — dialogue uses it for resolver context (protocol doesn't establish this one; the opening tree is static).

**Synchrony rule:** When a protocol trigger's `establishes` field sets a semantic fact that downstream consumers also need, the convention's transition rules MUST set the same fact in `conventionData`. This is verified by cross-engine invariant tests (Invariant 5).

**Rejected alternatives:** (a) Shared event model — iteration strategies differ (cursor+span vs entry-by-entry), adapter cost exceeds benefit. (b) Merge `EstablishedContext` into `DialogueState` — introduces dependency cycle (`EstablishedContext` is generic `<T>` per convention; `DialogueState` is fixed schema). (c) Bootstrap integration — bootstrap is assembly, not per-bid evaluation.

## Inference API

`inference-api.ts` is the narrow bridge from core protocol internals to `src/inference/`.

- `evaluateForInference(config, context)` returns only what inference needs: flattened conditioned rules + rejected decisions
- DTO boundary avoids inference importing `flattenProtocol`, `evaluateProtocol`, and other deep core modules directly
- `createBiddingContext` and `isAuctionCondition` are re-exported here for inference callers

## Diagnostics

`diagnostics.ts` runs registration-time analyzers via `analyzeConvention()`. Warning types:

- **`trigger-shadow`** — intra-round: earlier trigger subsumes a later one (first-match-wins shadowing)
- **`unreachable-node`** — cross-round: all triggers in a later round are subsumed by an earlier round (suppressed when seatFilters are disjoint, e.g., Bergen opener vs responder)
- **`transition-rule-overlap`** — two transition rules match the same (state, entry) pair
- **`orphan-family-member`** — `IntentFamily` member references a bidName not found in any protocol tree or overlay replacement tree
- `duplicate-node-id`, `overlay-priority-conflict`, `missing-resolver`, `full-scope-trigger`, `orphan-family-member` — existing checks

**TriggerDescriptor system** (`trigger-descriptor.ts`): Structured metadata on `RuleCondition.descriptor` enables semantic overlap/subsumption analysis. Condition factories attach descriptors; `not()`/`and()`/`or()` compose them. Conditions without descriptors (or with `{kind: "opaque"}`) are silently skipped — never produce false positives.

**TransitionRuleDescriptor** (`dialogue-transitions.ts`): Optional `matchDescriptor` on `TransitionRule` with fields `familyId`, `obligationKind`, `callType`, `level`, `strain`, `actorRelation`. Two descriptors overlap unless any shared field explicitly contradicts.

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
