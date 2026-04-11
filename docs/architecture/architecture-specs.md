# Architecture Specs & Open Questions

Current architecture snapshot for the repo as it exists today. This file is intentionally repo-owned and should stay aligned with the Rust/WASM implementation, not with external notes or superseded TS plans.

## Authoritative Sources

- `docs/architecture/design-philosophy.md` — architectural principles and decision rules
- `docs/architecture/teaching-architecture.md` — current meaning-pipeline, teaching, and grading model
- `docs/product/product-direction.md` — product-level rationale that constrains architecture
- `docs/architecture/migration/` — completed migration history and why the current Rust/WASM shape exists

Historical but still useful:

- `docs/architecture/posterior-implementation-plan.md` — exploratory future direction for richer posterior inference. Not the current production boundary.

## Current Architecture Snapshot

### 1. Convention Model

The convention system is data-driven and meaning-centric.

- Modules are portable data objects with authored facts, explanation entries, FSM/routing data, and optional host attachments.
- System differences flow through `SystemConfig`; modules remain system-agnostic.
- Bundle composition happens in the registry/spec-builder layer, not by modules referencing each other.

Primary code anchors:

- `crates/bridge-conventions/src/types/agreement.rs`
- `crates/bridge-conventions/src/types/module_types.rs`
- `crates/bridge-conventions/src/types/fact_types.rs`
- `crates/bridge-conventions/src/registry/spec_builder.rs`

### 2. Meaning Pipeline And Teaching

The canonical answer key comes from the Rust meaning pipeline:

1. Observation/routing collects matching surfaces.
2. Fact evaluation computes acting-hand facts plus relational/system overrides.
3. Pipeline evaluation arbitrates meanings and encodes legal calls.
4. Teaching projection and parse-tree builders turn pipeline output into learner-facing explanations.

Primary code anchors:

- `crates/bridge-conventions/src/pipeline/`
- `crates/bridge-conventions/src/adapter/protocol_adapter.rs`
- `crates/bridge-conventions/src/teaching/projection_builder.rs`
- `crates/bridge-conventions/src/teaching/parse_tree_builder.rs`

### 3. Session, Service, And UI Boundary

The UI and CLI call through `ServicePort`; all game logic remains behind the Rust boundary.

- `bridge-session` owns drill state, controllers, heuristics, and viewports.
- `bridge-service` owns the service/request-response boundary.
- `bridge-wasm` exposes the browser transport.
- `src/service/` is a thin TS proxy plus service-owned DTOs and display helpers.

Primary code anchors:

- `crates/bridge-session/src/session/`
- `crates/bridge-service/src/`
- `crates/bridge-wasm/src/lib.rs`
- `src/service/`

### 4. Inference And Play Realism

Inference currently has two layers:

- Public beliefs and annotations for bidding feedback and explanation surfaces
- A Monte Carlo posterior engine for play heuristics, implemented in Rust

The production posterior path is:

- `crates/bridge-session/src/inference/posterior.rs`
- `crates/bridge-session/src/session/play_controller.rs`
- `crates/bridge-session/src/heuristics/play_profiles.rs`

This is the current shipped boundary. The factor-graph/query-port redesign described in `posterior-implementation-plan.md` is future-looking research, not the active implementation contract.

## Spec Status

- Rust/WASM migration is complete. The current architecture is the shipped architecture, not a transitional hybrid.
- The repo docs above are authoritative. No personal Obsidian or off-repo notes are required to understand the current system.
- Most core contracts are stable: module portability, meaning-centric evaluation, ServicePort boundary, viewport boundary, and system-parameterized strategy.
- Historical docs are kept for rationale, but they should not override the code or current architecture docs.

## Active Architecture Questions

| Question | Current state | Blocks |
|---|---|---|
| Host-attachment exercise in real modules | Attachment contracts exist in the type system and runtime, but they are still lightly exercised in shipped content | Some convention migrations and add-on patterns, including Negative Doubles follow-on work |
| Public/full-deal fact evaluation worlds | `EvaluationWorld` supports `public` and `full-deal`, but `evaluate_facts()` currently computes only `acting-hand` facts | Richer inference facts and future explanatory views |
| Soft evidence / richer posterior queries | Production posterior is Monte Carlo rejection sampling against hard constraints; factor-graph and weighted-evidence ideas remain exploratory | Higher-fidelity posterior reasoning and more expressive play/inference consumers |

## Non-Questions (Already Resolved)

- Multi-system support is wired end-to-end. The backend accepts full `SystemConfig`, and the UI exposes system selection in settings/workshop flows.
- Activation traces exist and are populated from matched surfaces in the protocol adapter.
- Host attachments exist in the module and agreement types; the remaining work is adoption/exercise, not missing infrastructure.
