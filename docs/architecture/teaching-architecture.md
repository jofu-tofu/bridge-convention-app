# Teaching Architecture

The app separates two concerns:

- **Deterministic convention teaching** for bidding correctness and explanation
- **Probabilistic realism** for opponent modeling and card-play difficulty

## Meaning Pipeline

The canonical answer key is produced in Rust by the meaning pipeline:

1. Observation/routing collects matching surfaces from active modules.
2. Fact evaluation computes acting-hand facts, then relational/system overrides.
3. Arbitration selects legal meanings/calls and preserves provenance.
4. Teaching builders project the result into learner-facing explanations.

Key code paths:

- `crates/bridge-conventions/src/pipeline/`
- `crates/bridge-conventions/src/adapter/protocol_adapter.rs`
- `crates/bridge-conventions/src/teaching/projection_builder.rs`

Each `BidMeaning` carries authored teaching vocabulary such as `semanticClassId` and `teachingLabel`, which flow through to service DTOs and UI feedback.

## Alert And Public-Inference Layer

Alertability is resolved from `Disclosure`, not from UI heuristics.

- `crates/bridge-conventions/src/pipeline/evaluation/alert.rs` maps disclosure to alert/announce/educational output.
- Public constraints and annotations feed the bidding explanation layer and public-belief summaries exposed through service DTOs.

Inference remains conservative: the system uses hard constraints derived from chosen meanings, not cross-surface probabilistic denials during bid grading.

## Bid Grading

Bid grading is deterministic and 4-way:

- **Correct** — exact match with the selected bid
- **Acceptable** — alternative in the truth set
- **NearMiss** — close alternative, typically same surface group with limited failed conditions
- **Incorrect** — none of the above

Core grading lives in `crates/bridge-session/src/session/bid_feedback_builder.rs`; service/UI-specific assembly lives in `crates/bridge-service/src/feedback_assembler.rs`.

## Teaching Projection And Parse Tree

`project_teaching()` builds the learner-facing projection used by feedback, review, and debug views. Parse-tree data is built separately and attached to the projection for explainability/debug use.

- `crates/bridge-conventions/src/teaching/projection_builder.rs`
- `crates/bridge-conventions/src/teaching/parse_tree_builder.rs`

The practice UI intentionally does not foreground the raw parse tree. User-facing feedback emphasizes conditions, why-not explanations, and practical recommendations instead of exposing module-evaluation mechanics directly.

## Explanation Entries

Module-authored explanation entries live on each `ConventionModule` and are consumed by learning/flow-tree builders and teaching projection helpers.

- `crates/bridge-conventions/src/types/module_types.rs`
- `crates/bridge-session/src/session/learning_viewport.rs`
- `crates/bridge-session/src/session/flow_tree/`

These entries should be kept coverage-complete for authored meanings/facts because the learning viewport and teaching surfaces depend on them for readable explanations.

## Deal Generation

Deals for drills are generated in two coupled steps:

1. **Derivation.** `bridge_conventions::fact_dsl::inversion::derive_deal_constraints(&bundle, BaseSystemId)` unions the surface preconditions across `bundle.modules` + base-system modules (via `compose_surface_clauses`), inverts each surface composition into an `InvertedConstraint`, unions constraints within each seat, and maps the result to the engine's `SeatConstraint` shape. Authors never write `dealConstraints` by hand — adding a surface is the only input the generator needs. Fixture JSON carries no `dealConstraints` field.
2. **Rejection gate.** `bridge-service::deal_gating::build_deal_acceptance_predicate` produces a `DealAcceptancePredicate` that is injected into `StartDrillOptions`. A deal is accepted only if `suggest()` at the user's turn returns `Some(BidResult)` whose matched `ResolvedCandidateDTO.module_id` is in the bundle's `member_ids`. A match in a base module only, or a heuristic bid with no `module_id`, or no match at all → reject and resample. Budget is `NORMAL_DEAL_ATTEMPTS = 32`. On exhaustion, `tracing::warn` fires and `start_drill` falls through with the last deal (no panic, no error).

Authored Pass surfaces on target modules are first-class lesson material: when the generator lands a deal where the target module's own Pass surface matches, that counts as a valid on-convention drill.

The negative-doubles bundle retains a separate custom acceptance predicate (`NEGATIVE_DOUBLES_DEAL_ATTEMPTS`) because its pedagogy requires opener-shape constraints the derivation cannot yet infer.

### Known Limitations

**1. Target-surface granularity.**
Rationale: any member-module surface accepts — we don't distinguish "drill-worthy" headline surfaces from fallback/escape surfaces.
Failure mode: occasional technically-on-convention deals that hit a corner surface rather than the headline lesson.
Upgrade trigger: user complaints or drill-quality dip. Fix: add `drill_worthy: bool` to `AuthoredRankingMetadata` and filter.

**2. Base-module surface union is loose (no reachability filter).**
Rationale: we union ALL surfaces from base-system modules into the derivation, not just those reachable from target-module entries.
Failure mode: slightly looser derived constraints, marginally higher rejection-sampling attempt counts.
Upgrade trigger: `tracing::warn` budget-exhaustion logs in normal use OR sampling cost noticeably impacts `start_drill` latency. Fix: FSM reachability analysis over base→target paths.

**3. Union does not propagate `balanced`.**
Rationale: `invert_composition`'s union branch drops `balanced` bounds when any branch lacks them. Bundles whose only "balanced" signal comes from the SAYC 1NT-opening surface (e.g. `nt-transfers`) end up with no `balanced` constraint on the opener seat.
Failure mode: for NT-family bundles, the opener is rarely 15-17 balanced, so rejection sampling works harder or exhausts. The `nt-transfers` e2e test is currently `#[ignore]` pending fix.
Upgrade trigger: `nt-transfers` / NT-bundle budget-exhaustion warnings in prod, or a bundle where 1NT opening is the only path. Fix: either (a) `union_all` preserves `balanced=Some(true)` when at least one branch asserts it and others are silent, or (b) the inverter treats "surface is unreachable under current branch" differently from "surface is reachable but has no balanced opinion."

## Opponent Modes

Opponent bidding mode is part of `DrillSettings`:

- `none` — opponents always pass
- `natural` — opponents use a simple natural heuristic strategy

This is configured through settings and carried through the session/service boundary.

## Play Profiles

Card-play difficulty is controlled by `PlayProfileId`:

- **Beginner** — lighter heuristic play
- **Club Player** — stronger heuristic play with more inference use
- **Expert** — adds stronger card-reading heuristics
- **World Class** — Monte Carlo + DDS-assisted play

Key code paths:

- `crates/bridge-session/src/heuristics/play_profiles.rs`
- `crates/bridge-session/src/session/play_controller.rs`
- `crates/bridge-session/src/heuristics/play_types.rs`

This probabilistic layer affects play realism, not bidding correctness. Bidding teaching stays deterministic.
