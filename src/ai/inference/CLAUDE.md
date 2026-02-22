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
| `convention-inference.ts` | Extracts inferences from `ConditionedBiddingRule.conditions[].inference` |
| `condition-mapper.ts` | `extractInference()` reads `.inference` field, falls back to name parsing |
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

## Gotchas

- Inference errors never propagate to callers — `inferFromBid()` returns null, `mergeInferences()` clamps
- Convention inference provider needs convention registry access — imports `getConvention()`
- `isOwnPartnership()` checks bidder seat vs observer seat + partner

<!-- context-layer: generated=2026-02-22 | version=1 -->
