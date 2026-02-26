# Inference

Auction inference system — extracts hand information from bids with per-partnership information asymmetry.

## Key Concepts

- **Information asymmetry:** Partnerships share inference, not individual seats. N and S both know their convention. E and W both know SAYC. Asymmetry is between partnerships, not seats.
- **Difficulty spectrum:** `InferenceProvider` is the primary difficulty axis. `naturalInferenceProvider` (easy) → `conventionInferenceProvider` (medium) → full knowledge of opponent's convention (hard/oracle).
- **Incremental inference:** `processBid()` called after every bid, not at auction end. Phase 3 opponent AI uses mid-auction inferences.
- **Two engines per deal:** `nsEngine` and `ewEngine` with different `InferenceConfig`. Game store owns both, resets on new deal.

## Architecture

| File | Role |
|------|------|
| `types.ts` | Core interfaces: `HandInference`, `InferredHoldings`, `InferenceProvider`, `InferenceConfig` |
| `natural-inference.ts` | SAYC-default natural bidding theory inference (no convention knowledge) |
| `convention-inference.ts` | Extracts positive inferences from flat rules + negative from tree rejection data via `evaluateTree()` |
| `condition-mapper.ts` | `extractInference()`, `conditionToHandInference()`, `invertInference()`, `resolveDisjunction()` |
| `inference-engine.ts` | `createInferenceEngine(config, observerSeat)` — incremental per-bid processing |
| `merge.ts` | `mergeInferences()` — range intersection (narrowing), clamps contradictions |

## Merge Algorithm

Range intersection: `min = max(all minHcp)`, `max = min(all maxHcp)`. Suit lengths same per suit. Contradictions clamp to last inference's values and log warning. Never throws.

## `ConditionInference` Hybrid

Structured `.inference` field on `RuleCondition` is preferred. Name-based fallback exists for unannotated conditions. New conditions should always include `.inference`.

## Behavioral Invariants (test-encoded)

These architectural guarantees are encoded as tests in `__tests__/inference-behavioral.test.ts` (38 tests):

- **Partnership asymmetry:** Convention engine sees own partnership's conventions; natural engine does not. Same auction, different observer → different HCP ranges.
- **Provider scoping:** Convention provider only returns inferences for bids matching its rules (e.g., Stayman provider returns null for 1NT, which is outside Stayman's rule set).
- **Monotonic range narrowing:** `mergeInferences()` intersects ranges; additional inferences can only tighten, never widen bounds.
- **Contradiction clamping (design choice):** HCP contradiction → last inference's values win. Suit length contradiction → min clamped down to max.
- **Engine isolation:** Two engines with same config are independent; `reset()` fully clears state; `getInferences()` is non-mutating.
- **No-throw contract:** Throwing providers are swallowed; double/redouble don't break engine; empty auctions are safe.
- **Determinism:** Incremental processing equals batch replay — same inputs → same outputs.

## Negative Inference

Tree rejection data enables negative inference: when a decision node's condition fails, the inverse tells us what the hand does NOT have.

- **`invertInference(ci)`** — inverts a `ConditionInference`. `hcp-min:12` → `hcp-max:11`. `suit-min:4` → `suit-max:3`. `hcp-range` → disjunction. Returns null for uninvertible types (ace-count, king-count, two-suited).
- **`resolveDisjunction(options, cumulative)`** — picks the first non-contradicting branch of a disjunction. Returns null if all branches contradict cumulative state (no false inference).
- **Architecture invariant:** Inference calls `evaluateTree()` directly — never `evaluateBiddingRules()` — because the registry strips `rejectedDecisions` needed for negative inference.
- **Example:** Stayman 2D denial → rejected `has-4-hearts` (suit-min hearts 4) → inverted to suit-max hearts 3. Rejected `has-4-spades` → suit-max spades 3.

## Gotchas

- Inference errors never propagate to callers — `inferFromBid()` returns null, `mergeInferences()` clamps
- Convention inference provider needs convention registry access — imports `getConvention()` and `evaluateTree()`
- `isOwnPartnership()` checks bidder seat vs observer seat + partner
- Positive inferences use flat rules (call matching via `tryGetRuleCall`); negative inferences use tree eval (rejected decisions)

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

**Staleness anchor:** This file assumes `inference-engine.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-22 | last-audited=2026-02-25 | version=4 | dir-commits-at-audit=0 | tree-sig=dirs:2,files:14,exts:ts:13,md:1 -->
