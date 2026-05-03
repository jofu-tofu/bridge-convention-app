# Drill Targeting and Pattern Witnesses

This document records the design decisions behind the multi-phase
"drill-targeting" refactor that replaces ad-hoc, per-bundle drill-prefix
synthesis with a uniform witness-driven path. Future agents should consult
this document before re-litigating its decisions.

## Layering invariant

The evaluation model — **surfaces, FactComposition clauses, the strategy
adapter, and the meaning pipeline** — does not change in this refactor. All
changes are confined to:

1. The witness data type (`bridge_conventions::fact_dsl::witness::Witness` and
   the patternized call spec it carries) and its consumers
   (`bridge_service::deal_gating`, `bridge_service::witness_selection`).
2. The shape of `SessionConfig.target` (TS) / `SessionConfig.target` (Rust),
   replacing the prior `targetModuleId: Option<String>` field with a
   `TargetSelector` discriminated union (`any | module | surface`).
3. NMF and negative-doubles fixture authoring (Phases 2 / 3) — pulling the
   hand-coded prefix logic into authored surfaces and FactComposition trees.
4. Deletion of three hand-coded prefix-synthesis functions in
   `crates/bridge-session/src/session/start_drill.rs`
   (`negative_doubles_sequence`, `negative_doubles_opener_sequence`,
   `nmf_initial_auction`).

Anything outside these four columns is intentionally out of scope and should
not be perturbed by the refactor.

## Alternatives considered and rejected

- **"Explode state entries"** — author one `StateEntry` per
  `(minor, major)` combination so each drill prefix is reachable through a
  distinct authored entry. Rejected: it does not scale to negative doubles'
  combinatoric space (opening × overcall × responder action), where the entry
  count quickly exceeds what's manageable in a fixture file.
- **"Deal-introspection DSL primitive"** — extend FactComposition with a
  primitive that introspects the live deal during route reification.
  Rejected: it couples route reification to hand evaluation. Today these are
  separate concerns (witness reification produces a route prefix; the
  strategy adapter evaluates hand facts to choose a bid). Coupling them
  collapses an architectural layer that pays its way for everything except
  prefix synthesis.
- **"Pattern-capable witness"** — let the witness call spec be either a
  concrete `Call` or a pattern that the existing `ObsPattern` infrastructure
  (`crates/bridge-conventions/src/types/rule_types.rs`) can match against.
  Deal-conditional bid selection then lives where it already lives: the
  strategy adapter. **This is the chosen path.**
- **"Half-migration of negdbl"** — migrate negdbl deal generation to the
  new witness path but keep the bespoke prefix synthesis. Rejected: it
  leaves the special-case branch in
  `bridge-service/src/drill_setup.rs` and the bespoke 256-attempt budget in
  `start_drill::start_drill` intact, defeating the refactor's purpose
  (removing the special cases).
- **"DB migration"** — the prior `targetModuleId` is launch-time-only and is
  never persisted on the server (`crates/bridge-api/migrations/004_user_drills.sql`
  has no such column on `user_drills`). No migration is required for the
  Phase 1 type change.

## Decision criteria

The chosen path was selected against four criteria:

- **Robustness to combinatoric explosion** — we want the authored fixture
  size to grow linearly with the number of distinct *meanings*, not
  multiplicatively with the deal-shape combinations that produce them.
- **Reuse of existing primitives** — patterns are already a first-class
  primitive (`ObsPattern`, `RouteExpr`); extending the witness call spec to
  carry a pattern reuses primitives the system already has, rather than
  introducing a new orthogonal layer.
- **Minimal surface-area change** — keep the evaluation model untouched so
  that surfaces, clauses, and the strategy adapter are unaffected. The
  refactor lives at the witness / deal-gating boundary.
- **Layered, deletable migrations** — each phase is independently shippable
  and removes code from the system rather than adding parallel paths. The
  exhaustion budget shrinks as fixtures absorb the special cases.

## Phase 1 (this commit): `TargetSelector`

`SessionConfig.targetModuleId: Option<String>` is replaced end-to-end with
`SessionConfig.target: Option<TargetSelector>`, where:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TargetSelector {
    Any,
    Module { module_id: String },
    Surface { module_id: String, surface_id: String },
}
```

The TS shape is the matching discriminated union. Behavior is unchanged
because every existing caller maps `Some(id) →
Some(TargetSelector::Module { module_id: id })`. The `Any` and `Surface`
variants exist for Phase 2+ consumers (drilling a specific surface within a
module).

`witness_selection::select_witness` and its helper `candidate_surfaces` now
take a `&TargetSelector` directly. `Surface` variants additionally constrain
candidate surfaces by `meaning_id`.

The prior `targetModuleId` field is **gone**, not deprecated. There is no
backward-compatibility shim — call sites mechanically migrate.

## Phase 2 status (this commit): pattern-capable witnesses + NMF migration

`WitnessCall` now carries a `WitnessCallSpec` (`Concrete(Call) | Pattern(ObsPattern)`)
instead of a bare `Call`; pattern matching honors the new
`ObsPattern.suit_class` qualifier (`Minor | Major | Suit`). Witness materialization
(`bridge_service::witness_selection::initial_auction_from_witness`) now takes
`&Deal` plus seat strategies and runs post-flight in `drill_setup` for pattern
witnesses, falling back to the live adapter for each pattern step. The
`build_witness_acceptance_predicate` predicate consumes the same matcher.
NMF is now authored as a fixture state entry (Subseq route through
`1m – 1M – 1NT`) rather than synthesized in `start_drill.rs`; the imperative
`nmf_initial_auction` / `is_nmf_bundle` / `NMF_BUNDLE_ID` were deleted.
Negative-doubles bundle behavior is unchanged (Phase 3 will migrate it).

## Phase 3 status: negative-doubles witness migration

`WitnessCall` now carries a `role: WitnessRole` tag with two variants:
`Partnership` (the default; preserves pre-Phase-3 behavior on serialized
witnesses) and `Opponent`. Witness derivation walks each route's authored
`actor` field and stamps `Opponent` when `actor == TurnRole::Opponent`,
`Partnership` otherwise; the seat is `seat_for_turn(actor, dealer)` when
authored or a partnership-cursor backstop when omitted.

`bridge_service::deal_gating::ScriptedOpponentStrategy` is a new stateless
strategy that replays opponent witness steps during predicate prefix
replay only. It walks the witness prefix relative to
`ctx.auction.entries.len()`; if the entry at that position is an Opponent
step at `ctx.seat` with a `Concrete` spec, it returns the authored call,
otherwise returns `None` so the chain falls through to the live opponent
strategy (`Pragmatic` / `NaturalFallback` / `Pass`). Pattern opponent
steps also fall through and are validated by the predicate's
`expected.spec.matches(&call)` gate. `build_predicate_seat_strategies`
takes `&Witness` so the scripted layer is installed only on opponent
seats that appear as `Opponent` steps in the witness.

The negative-doubles bypass is **deleted**: `is_negative_doubles_bundle`,
`NEGATIVE_DOUBLES_BUNDLE_ID`, `NEGATIVE_DOUBLES_DEAL_ATTEMPTS`,
`negative_doubles_opening_call`, `negative_doubles_overcall_call`,
`negative_doubles_sequence`, `negative_doubles_opener_sequence`, and
`negative_doubles_responder_can_double` are all gone. The
`negative-doubles-bundle` arm in `drill_setup.rs` (`is_negdbl`) is gone.
Every drillable bundle now flows through `selector → witness → prefix →
predicate → deal`.

The `negative-doubles` module is patched at module-cache init time
(`patch_negative_doubles_module`):

- Each responder state entry's `Last { overcall ... }` route is wrapped
  in a `Subseq { [open(actor: opener, level: 1, strain), overcall(actor: opponent)] }`,
  with the opening strain derived from the `after-oc-1<X>` phase string.
- Synthesized opener-rebid states (`build_negative_doubles_after_negdbl_states`)
  use `negdbl_route_expr` which now emits a `Subseq` whose overcall step
  has `actor: Opponent` and whose open step has `actor: Opener` plus
  `level: 1`.

Adaptive deal-attempt budget:
`StartDrillOptions.deal_attempts: Option<u64>` lets the service scale
rejection-sampling per witness. `drill_setup` sets it to
`NORMAL_DEAL_ATTEMPTS * (1 + min(prefix_len/2, 4))` so longer witness
prefixes (e.g. negdbl-opener at 3 steps) get a 2x budget. `None` falls
back to `NORMAL_DEAL_ATTEMPTS = 32`.

Phase 0 characterization tests in
`crates/bridge-service/tests/drill_setup_characterization.rs` continue to
pass unmodified — they are the integration test for the whole Phase 3
stack. The negdbl-responder test asserts the 2-call prefix
`[N: 1m-or-1M, E: overcall]`; the negdbl-opener test asserts the 4-call
prefix `[S: 1m-or-1M, W: overcall, N: Double, E: Pass]`.

## Phase 4 status: productionized failure path

`ServiceError::DealGenerationExhausted` is now catchable from TS via a
typed discriminator at the WASM boundary. `bridge-wasm::service_error`
serialises the variant as a JSON sidecar
`{ kind: "dealGenerationExhausted", witnessSummary }` carried on
`JsError.message`; TS lifts that to a `DealGenerationExhaustedError`
class and exposes `isDealGenerationExhausted(err)` from
`src/service/service-errors.ts`. Other `ServiceError` variants keep the
plain `Display` message — they are not catchable by discriminant. The
inner `start_drill` error string format (`"deal generation exhausted: …"`)
is unchanged; the typed wrapper sits at the WASM boundary only, so the
Phase 0 characterization test still passes verbatim.

`createGameStore.startNewDrill` performs one automatic retry on
`DealGenerationExhausted` with a fresh seed (omits `config.seed` so the
service generates one). On second exhaustion it sets a
`drillError: { kind: "dealGenerationExhausted" }` on the game store;
`GameScreen.svelte` renders `DrillErrorModal.svelte` over the loading
state with copy "Couldn't generate a hand for this drill — try a
different convention, or refresh the page and try again." Try again
re-runs `startNewDrill`; Close routes back to the practice picker.

The adaptive deal-attempt budget (`drill_setup::deal_attempt_budget`) is
now locked by `crates/bridge-service/src/drill_setup.rs::tests::deal_attempt_budget_scales_with_witness_prefix_length`,
which pins the formula `1 + min(prefix_len / 2, 4)` × `NORMAL_DEAL_ATTEMPTS`
across the full saturation curve (0/1 → 1×, 2/3 → 2×, …, 8+ → 5×).

When all 8 outer retries fail, `drill_setup` emits a structured
`tracing::warn!` event with `counter.drill_generation_exhausted = 1`
carrying `convention_id`, `target_kind`, `target_module_id`,
`target_surface_id`, and `attempts_used = MAX_DRILL_SETUP_RETRIES` so
downstream telemetry can group failures by `(convention_id,
target_surface_id)` for triage.
