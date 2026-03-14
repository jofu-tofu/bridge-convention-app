# Inference

Auction inference system — extracts hand information from bids with per-partnership information asymmetry.

## Key Concepts

- **Information asymmetry:** Partnerships share inference, not individual seats. N and S both know their convention. E and W both know SAYC. Asymmetry is between partnerships, not seats.
- **Difficulty spectrum:** `InferenceProvider` is the primary difficulty axis. `naturalInferenceProvider` (easy) → posterior engine (medium) → full knowledge of opponent's convention (hard/oracle).
- **Incremental inference:** `processBid()` called after every bid, not at auction end. Phase 3 opponent AI uses mid-auction inferences.
- **Two engines per deal:** `nsEngine` and `ewEngine` with different `InferenceConfig`. Game store owns both, resets on new deal.

## Architecture

| File | Role |
|------|------|
| `types.ts` | Core interfaces: `ConditionInference`, `InferenceExtractorInput`, `InferenceExtractor`, `InferenceProvider`, `InferenceConfig`, `BidAnnotation`, `PublicBeliefState`. `ConditionInference` is now owned locally (no conventions/core dependency). |
| `natural-inference.ts` | SAYC-default natural bidding theory inference (no convention knowledge) |
| `condition-mapper.ts` | `conditionToHandInference()`, `invertInference()`, `resolveDisjunction()` — maps `ConditionInference` → `HandInference` |
| `inference-engine.ts` | `createInferenceEngine(config, observerSeat)` — incremental per-bid processing |
| `merge.ts` | `mergeInferences()` — range intersection (narrowing), clamps contradictions |
| `belief-accumulator.ts` | `createInitialBeliefState()`, `applyAnnotation()` — public belief state management |
| `annotation-producer.ts` | `produceAnnotation()` — creates `BidAnnotation` from auction entry + rule result |
| `noop-extractor.ts` | `noopExtractor` — no-op `InferenceExtractor` used by the store |
| `private-belief.ts` | `PrivateBeliefState`, `conditionOnOwnHand(publicBelief, seat, hand, eval)` — narrows partner suit lengths using own hand (13 minus own length caps partner max) |
| `partner-interpretation.ts` | `PartnerInterpretationDTO`, `computePartnerInterpretation()` — models what partner would infer from a candidate bid, computes `misunderstandingRisk` and `continuationAwkwardness`. Consumed by `practical-recommender.ts` |
| `belief-converter.ts` | `toBeliefData()` — converts `PublicBeliefState` → `BeliefData` structural type |
| `posterior/` | Posterior inference engine — sampling, compilation, and fact evaluation for probabilistic hand inference |

## Contracts Boundary

- Cross-boundary shapes consumed by inference, such as `HandInference`, `InferredHoldings`, `EvidenceBundleIR`, and `BidAlert`, live in `src/core/contracts/`.
- `inference/types.ts` is the subsystem-local interface layer including the locally-owned `ConditionInference` type.

## Merge Algorithm

Range intersection: `min = max(all minHcp)`, `max = min(all maxHcp)`. Suit lengths same per suit. Contradictions clamp to last inference's values and log warning. Never throws.

## Negative Inference

Rejection data enables negative inference: when a condition fails, the inverse tells us what the hand does NOT have.

- **`invertInference(ci)`** — inverts a `ConditionInference`. `hcp-min:12` → `hcp-max:11`. `suit-min:4` → `suit-max:3`. `hcp-range` → disjunction. Returns null for uninvertible types (two-suited).
- **`resolveDisjunction(options, cumulative)`** — picks the first non-contradicting branch of a disjunction. Returns null if all branches contradict cumulative state (no false inference).

## Public Belief State

Public belief state = kibitzer view of the auction. Per-seat `InferredHoldings` narrowed monotonically as bids are made.

- **`BidAnnotation`:** Per-bid record with call, seat, ruleName, conventionId, meaning, alert, inferences.
- **`PublicBeliefState`:** `Record<Seat, InferredHoldings>` + `BidAnnotation[]`. Created fresh per deal via `createInitialBeliefState()`.
- **`applyAnnotation()`:** Merges annotation inferences into seat's beliefs via `mergeInferences()`. Returns new immutable state.
- **`produceAnnotation()`:** Convention bids → inferences from extractor. Natural bids → inferences from `naturalInferenceProvider`. Pass/double/redouble → empty inferences.
- **HCP narrowing:** `conditionOnOwnHand()` caps partner HCP max at `40 - ownHcp` (conservative bound). `toBeliefData()` uses narrowed `partnerHcpRange` for partner seat when private override present.

## Gotchas

- Inference errors never propagate to callers — `inferFromBid()` returns null, `mergeInferences()` clamps
- `isOwnPartnership()` checks bidder seat vs observer seat + partner

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

<!-- context-layer: generated=2026-02-22 | last-audited=2026-06-11 | version=6 | tree-sig=dirs:2,files:14,exts:ts:13,md:1 -->
