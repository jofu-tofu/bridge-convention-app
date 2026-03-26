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
| `inference-types.ts` | Cross-boundary inference types (moved from `core/contracts/inference.ts`): `HandInference`, `SuitInference`, `PublicBeliefs`, `DerivedRanges`, `QualitativeConstraint`, `BeliefData`, `InferenceProvider` |
| `types.ts` | Core interfaces: `ConditionInference`, `InferenceExtractorInput`, `InferenceExtractor`, `InferenceProvider`, `InferenceConfig`, `BidAnnotation`, `PublicBeliefState`. `ConditionInference` is now owned locally (no conventions/core dependency). |
| `natural-inference.ts` | System-parameterized natural bidding theory inference (accepts `SystemConfig`, defaults to SAYC) |
| `condition-mapper.ts` | `conditionToHandInference()`, `invertInference()`, `resolveDisjunction()` — maps `ConditionInference` → `HandInference` |
| `inference-engine.ts` | `createInferenceEngine(config, observerSeat)` — incremental per-bid processing |
| `derive-beliefs.ts` | `derivePublicBeliefs()` — derives `PublicBeliefs` from accumulated `FactConstraint[]`. Replaces old `mergeInferences()` with lossless constraint-first model. Source of truth is always the raw constraints array; ranges and qualitative labels are computed from it. |
| `inference-coordinator.ts` | `InferenceCoordinator` — coordinates NS and EW inference engines for a drill. Accepts optional `SystemConfig` for system-aware natural inference. Adapts `BidResult` → `InferenceExtractorInput`, manages belief state accumulation per deal. |
| `belief-accumulator.ts` | `createInitialBeliefState()`, `applyAnnotation()` — public belief state management |
| `annotation-producer.ts` | `produceAnnotation()` — creates `BidAnnotation` from auction entry + rule result |
| `noop-extractor.ts` | `noopExtractor` — no-op `InferenceExtractor` used by the store |
| `private-belief.ts` | `PrivateBeliefState`, `conditionOnOwnHand(publicBelief, seat, hand, eval)` — narrows partner suit lengths using own hand (13 minus own length caps partner max) |
| `partner-interpretation.ts` | `PartnerInterpretationDTO`, `computePartnerInterpretation()` — models what partner would infer from a candidate bid, computes `misunderstandingRisk` and `continuationAwkwardness` |
| `belief-converter.ts` | `toBeliefData()` — converts `PublicBeliefState` → `BeliefData` structural type |
| `posterior/` | Posterior inference engine — sampling, compilation, and fact evaluation for probabilistic hand inference. See `posterior/CLAUDE.md` for details. |
| `posterior/factor-compiler.ts` | `compileFactorGraph()`, `validateFactorGraph()` — compiles `PublicSnapshot` → `FactorGraph`. Convention-erased. |
| `posterior/ts-posterior-backend.ts` | `createTsBackend()` — `PosteriorBackend` implementation wrapping existing sampler. Answers `PosteriorQuery` queries. |
| `posterior/query-port.ts` | `createQueryPort()` — creates `PosteriorQueryPort` from backend + state. Consumer-facing query interface. |

## Absorbed Types (from former core/contracts/)

- `inference-types.ts` — Cross-boundary inference types (`HandInference`, `PublicBeliefs`, `InferenceProvider`) moved from `core/contracts/inference.ts`.
- `posterior/posterior-types.ts` — Posterior types (`PosteriorFactProvider`, `BeliefView`, `PublicHandSpace`) moved from `core/contracts/posterior.ts`.
- `posterior/posterior-boundary.ts` — Posterior boundary types (`FactorGraph`, `PosteriorQueryPort`, `PosteriorBackend`, etc.) merged from `core/contracts/factor-graph.ts`, `posterior-query.ts`, `posterior-backend.ts`.
- `inference/types.ts` is the subsystem-local interface layer including the locally-owned `ConditionInference` type.

## Belief Derivation

Constraint-first model via `derive-beliefs.ts`: accumulated `FactConstraint[]` per seat are the source of truth. `derivePublicBeliefs()` computes `DerivedRanges` (HCP min/max, per-suit length min/max) and qualitative constraints from the raw constraint array. This replaced the old `mergeInferences()` range-intersection approach with a lossless model — no information is discarded during accumulation.

## Negative Inference

Rejection data enables negative inference: when a condition fails, the inverse tells us what the hand does NOT have.

- **`invertInference(ci)`** — inverts a `ConditionInference`. `hcp-min:12` → `hcp-max:11`. `suit-min:4` → `suit-max:3`. `hcp-range` → disjunction. Returns null for uninvertible types (two-suited).
- **`resolveDisjunction(options, cumulative)`** — picks the first non-contradicting branch of a disjunction. Returns null if all branches contradict cumulative state (no false inference).

## Public Belief State

Public belief state = kibitzer view of the auction. Per-seat `InferredHoldings` narrowed monotonically as bids are made.

- **`BidAnnotation`:** Per-bid record with call, seat, ruleName, conventionId, meaning, alert, inferences.
- **`PublicBeliefState`:** `Record<Seat, InferredHoldings>` + `BidAnnotation[]`. Created fresh per deal via `createInitialBeliefState()`.
- **`applyAnnotation()`:** Merges annotation inferences into seat's beliefs. Returns new immutable state.
- **`produceAnnotation()`:** Convention bids → inferences from extractor. Natural bids → inferences from `naturalInferenceProvider`. Pass/double/redouble → empty inferences.
- **HCP narrowing:** `conditionOnOwnHand()` caps partner HCP max at `40 - ownHcp` (conservative bound). `toBeliefData()` uses narrowed `partnerHcpRange` for partner seat when private override present.
- **`publicBeliefs` removed from `PublicSnapshot`** (Phase 2). Belief views are now accessed via `PosteriorQueryPort` instead of being eagerly attached to the snapshot. This decouples snapshot construction from posterior inference.

## Gotchas

- Inference errors never propagate to callers — `inferFromBid()` returns null, belief derivation clamps contradictions
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

<!-- context-layer: generated=2026-02-22 | last-audited=2026-03-18 | version=8 | tree-sig=dirs:2,files:17,exts:ts:16,md:2 -->
