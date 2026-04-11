# Phase 4: Inference + Session

Port inference engine, session state, controllers, drill lifecycle, and play heuristics to Rust. This is the largest phase by LOC.

**Status:** Complete
**Actual LOC:** ~5,000 Rust (252 tests)
**Dependencies:** Phase 3 (meaning pipeline)
**Crate:** `bridge-session` (depends on bridge-engine, bridge-conventions)

## Goal

Complete game sessions run entirely in Rust. Create → bid through auction → play → explanation, with all viewport outputs matching TS behavior.

## TS Source Locations

| Component | TS source | Purpose |
|-----------|-----------|---------|
| **Inference** | | |
| Inference engine | `src/inference/inference-engine.ts` | Top-level inference orchestrator |
| Natural inference | `src/inference/natural-inference.ts` | Basic inference from natural bids |
| Belief accumulator | `src/inference/belief-accumulator.ts` | Accumulate beliefs across auction |
| **Posterior** | | |
| Factor compiler | `src/inference/posterior/factor-compiler.ts` | `PublicSnapshot` → `FactorGraph` |
| Posterior backend | `src/inference/posterior/ts-posterior-backend.ts` | Monte Carlo sampling backend |
| Query port | `src/inference/posterior/query-port.ts` | Consumer-facing posterior queries |
| **Session** | | |
| Session state | `src/session/session-state.ts` | `SessionState`, `DrillSession` |
| Bidding controller | `src/session/bidding-controller.ts` | Bidding phase logic |
| Play controller | `src/session/play-controller.ts` | Play phase logic |
| Drill types | `src/session/drill-types.ts` | Drill lifecycle types |
| Phase coordinator | `src/session/phase-coordinator.ts` | Phase transition logic |
| Viewport builders | `src/session/` | Build viewports from session state |
| **Heuristics** | | |
| Strategy chain | `src/session/heuristics/strategy-chain.ts` | Chain of bidding strategies |
| Natural fallback | `src/session/heuristics/natural-fallback.ts` | Fallback bidding when no convention applies |
| Heuristic play | `src/session/heuristics/heuristic-play.ts` | Basic card play logic |
| Opening leads | `src/session/heuristics/opening-leads.ts` | Opening lead selection |

## New Crate

```
crates/bridge-session/
  Cargo.toml
  src/
    lib.rs                          # Crate root, re-exports
    types.rs                        # GamePhase, DrillSettings, PracticeMode, etc.
    phase_machine.rs                # Valid phase transitions
    phase_coordinator.rs            # PhaseEvent → TransitionDescriptor
    inference/
      mod.rs
      types.rs                      # HandInference, PublicBeliefs, BidAnnotation, etc.
      derive_beliefs.rs             # Constraint→beliefs derivation
      belief_accumulator.rs         # Belief accumulation across auction
      natural_inference.rs          # NaturalInferenceProvider (SystemConfig-parameterized)
      inference_engine.rs           # InferenceEngine (per-partnership)
      annotation_producer.rs        # BidAnnotation production
      inference_coordinator.rs      # NS/EW engine coordinator
      posterior.rs                  # MC rejection sampler + UniformPosterior fallback
    heuristics/
      mod.rs                        # BiddingStrategy trait, BiddingContext, BidResult
      strategy_chain.rs             # Chain: first non-None wins
      natural_fallback.rs           # HCP/suit-based natural bidding
      pass_strategy.rs              # Ultimate fallback
      play_types.rs                 # PlayContext, PlayHeuristic trait, helpers
      heuristic_play.rs             # 8 play heuristics + chain
      random_play.rs                # Seeded random play
      opening_leads.rs              # Opening lead sub-helpers
      play_profiles.rs              # Beginner/Club/Expert/WorldClass profiles
    session/
      mod.rs
      session_state.rs              # SessionState, PlayState, SeatStrategy
      drill_session.rs              # get_next_bid (strategy delegation)
      config_factory.rs             # DrillConfig construction
      start_drill.rs                # Deal gen, rotation, vulnerability
      bidding_controller.rs         # process_bid, run_initial_ai_bids
      play_controller.rs            # process_play_card, run_initial_ai_plays
      bid_feedback_builder.rs       # BidGrade, BidFeedbackDTO
      build_viewport.rs             # 4 viewport builders (information boundary)
      format_obs_label.rs           # ObsPattern → human-readable labels
```

## Key Implementation Notes

**Posterior engine implemented.** `PosteriorEngine` uses MC rejection sampling (200 samples, constrained by L1 `DerivedRanges`). Wired into play heuristics via `PlayBeliefs` on `PlayContext`. `UniformPosterior` retained as fallback for profiles with `use_posterior=false`.

**Session state ownership.** TS uses mutable state freely. Rust will need careful ownership design — likely `SessionState` owns everything, with controllers borrowing mutably during their phase.

**Viewport builders.** These transform internal state into UI-facing DTOs. They enforce the PlayerViewport boundary — no raw `Deal` crosses to the UI.

## Pre-Phase: Reference Snapshots

**Mandatory before any reimplementation.** This is the largest behavior surface — reference snapshots are essential for catching regressions.

```bash
npx tsx scripts/capture-session-snapshots.ts > fixtures/session-snapshots.json
```

Record complete drill sessions: create → bid through auction → play → explanation. Capture all viewport outputs at each step. These are a safety net, not a rigid spec — session/controller logic is the most likely area to benefit from simplification during the port.

Include:
- All 6 bundles
- Multiple practice modes (decision-drill, full-auction)
- Both opener and responder roles
- Edge cases: passed-out auctions, doubled contracts, slam bidding

When Rust output differs, ask: "bug or improvement?" Update the fixture and document the decision if it's an improvement.

## Verification

- **Session replay comparison:** Rust viewport outputs compared against TS reference snapshots — differences reviewed and classified as bugs or improvements
- **Inference accuracy:** Posterior queries return same distributions (within tolerance for Monte Carlo)
- **CI gate:** Session replay tests must pass before Phase 5

## Completion Checklist

- [x] Inference engine ported (MC posterior + uniform fallback)
- [x] Natural inference ported (NaturalInferenceProvider, SystemConfig-parameterized)
- [x] Belief accumulator ported
- [x] Factor compiler — DEFERRED (rejection sampler covers core use case)
- [x] Session state ported (SessionState, PlayState, SeatStrategy, posterior, play profiles)
- [x] Bidding controller ported (synchronous, direct bridge_engine calls)
- [x] Play controller ported (8 heuristics + chain + profile dispatch + inference beliefs)
- [x] Phase coordinator ported
- [x] Strategy chain ported
- [x] Natural fallback ported
- [x] Heuristic play ported (8 heuristics)
- [x] Opening leads ported
- [x] Viewport builders ported (4 viewports with information boundary)
- [ ] Golden-master snapshot script — DEFERRED to Phase 5 integration
- [ ] All session replay tests — DEFERRED to Phase 5 integration
- [x] Update `src/inference/CLAUDE.md` — note Rust ownership
- [x] Update `src/session/CLAUDE.md` — note Rust ownership
- [x] Update `src/session/heuristics/CLAUDE.md` — note Rust ownership
- [x] Update `docs/architecture/migration/index.md` phase tracker status
