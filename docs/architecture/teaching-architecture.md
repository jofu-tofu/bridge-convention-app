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

## Off-Convention Drills

Bundles can define `offConventionConstraints` so the drill generator sometimes produces deals where the target convention does not apply. This trains recognition, not just execution.

- Bundle-level anti-constraints live in convention fixtures.
- `DrillTuning.includeOffConvention` and `offConventionRate` control frequency.
- Service responses mark the result with `isOffConvention`.

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
