# Phase 6: TS/Rust Behavioral Reconciliation

Post-migration audit reconciling behavioral differences between the deleted TS backend and the current Rust implementation. These are not bugs introduced during migration — they are features, logic paths, and capabilities that were simplified or deferred during the port.

**Status:** In Progress (P0 complete, most P1 complete, P2/P3 remaining)
**Dependencies:** Phase 5 (complete)

## Severity Legend

- **P0 — Breaking:** User-facing behavior is wrong or misleading. Must fix.
- **P1 — Degraded:** Feature exists but quality/fidelity is noticeably reduced. Should fix.
- **P2 — Missing feature:** Capability absent but workaround exists or impact is narrow. Fix when relevant.
- **P3 — Stub/cosmetic:** Acknowledged stub or debug-only gap. Fix opportunistically.

---

## 1. Bid Grading & Feedback

### 1.1 ~~Binary grading instead of 5-tier~~ (P0) ✅ COMPLETE

**Fixed:** `convention_adapter.rs` now wires `truth_set_calls` and `acceptable_set_calls` from `PipelineResult` into `BidResult`. The grading logic in `bid_feedback_builder.rs` already handled all 5 grades — it just needed the data. 5 previously-ignored RED tests now pass. Note: `Acceptable` grade won't fire in practice until item 3.7 (acceptable_set == truth_set in pipeline).

### 1.2 ~~No teaching detail in bid feedback~~ (P1) ✅ COMPLETE

**Fixed:** `BidSubmitResult` now includes `teaching: Option<TeachingDetailDTO>` with full pipeline data: primary explanation nodes, why-not entries, convention contributions, meaning views, call views, parse tree, observation history, practical recommendation, acceptable bids, near-miss calls, ambiguity score, grading type, and evaluation completeness. `feedback_assembler.rs` transforms `StrategyEvaluation` (stashed in `ConventionStrategyAdapter` via `RwLock`) into the DTO. Parse tree is now attached to `TeachingProjection` in `protocol_adapter.rs::build_evaluation()`.

### 1.3 ~~No viewport feedback builder~~ (P1) ✅ COMPLETE

**Fixed:** `BidSubmitResult.feedback` is now `Option<ViewportBidFeedbackDTO>` (was `Option<BidFeedbackDTO>`). `feedback_assembler::assemble_viewport_feedback()` projects conditions, acceptable alternatives, near misses, partner hand space, convention contributions, correct bid label/explanation from the stashed `StrategyEvaluation`. Falls back to basic explanation when no evaluation is available.

---

## 2. Bid History & Annotations

### 2.1 ~~Empty bid history in viewports~~ (P0) ✅ COMPLETE

**Fixed:** `SessionState` now accumulates `bid_history: Vec<BidHistoryEntryView>` from inference annotations. `process_bid()` takes `is_user` and `is_correct` params and builds a `BidHistoryEntryView` from the latest `BidAnnotation` after each inference call. All 6 viewport builder calls in `service_impl.rs` now receive populated bid history from `session.state.bid_history`. Meaning passthrough fixed: `explanation` is now passed as `meaning` to the inference coordinator so annotations get convention descriptions instead of generic "Natural bid" / "Pass".

### 2.2 ~~Missing historyEntry in AI bid entries~~ (P1) ✅ COMPLETE

**Fixed:** `AiBidEntry` and `AiBidEntryDTO` now carry `history_entry: BidHistoryEntryView` with full meaning/annotation data per AI bid. `BidProcessResult` and `BidSubmitResult` carry `user_history_entry: Option<BidHistoryEntryView>` for the user's bid. History entries are captured from `SessionState.bid_history` immediately after each `process_bid()` call.

---

## 3. Convention Adapter & Pipeline

### 3.1 ~~Kernel delta never advances in observation log~~ (P0) ✅ COMPLETE

**Fixed:** Added `apply_negotiation_actions()` to `negotiation_extractor.rs` — interprets BidActions (Open, Transfer, Accept, Raise, Agree, Force, Signoff, Place, Overcall, Double, Redouble) and advances NegotiationState. Wired into all 3 call sites: `protocol_adapter.rs`, `convention_adapter.rs` (build_step_from_carrier + build_call_inferred_step). 10 unit tests + 1 integration test verify kernel advancement through transfer-acceptance sequences.

### 3.2 ~~Relational context missing from pipeline~~ (P0) ✅ COMPLETE

**Fixed:** During observation log replay in `convention_adapter.rs`, `evaluate_facts()` now receives `RelationalFactContext` derived from the previous step's `state_after.fit_agreed` (which is populated by 3.1's kernel advancement). The final user-turn evaluation already had relational context from `derive_fit_from_log`; this fix ensures replay steps also get it, so fact evaluation during pipeline replay is correct for fit-dependent facts.

### 3.3 ~~Practical scoring algorithm completely different~~ (P1) ✅ COMPLETE

**Fixed:** `score_candidate_practically()` now accepts `Option<&PartnerContext>` with partner's min HCP and suit lengths. Partnership HCP scoring uses `(hcp + partner_min_hcp) - PARTNERSHIP_LEVEL_TABLE[level]` weighted at 1.5. Fit scoring for suit bids uses `(own_suit_len + partner_min_suit_len)` weighted at 2.0. The `PartnerContext` parameter is threaded through `ConventionStrategy::suggest()` → `build_evaluation()` → `build_practical_recommendation()`. Session-level partner belief integration (passing actual `PublicBeliefs` from inference coordinator) is deferred to trait boundary refactor — currently passes `None` through `suggest_bid()` (BiddingStrategy trait).

### 3.5 Semantic class alias deduplication missing (P1)

**TS:** `deduplicateBySemanticClassAlias()` resolved alias pairs before deduplication, allowing cross-module semantic equivalence.

**Rust:** `deduplicate_by_semantic_class()` checks raw `semantic_class_id` only — no alias resolution.

**Files:** `bridge-conventions/src/pipeline/meaning_arbitrator.rs`

**Fix:** Add alias map parameter and resolution step.

### 3.6 inheritedDimsLookup is flat instead of per-meaning (P2)

**TS:** `inheritedDimsLookup: Map<string, ConstraintDimension[]>` — per-meaning inherited dimensions.

**Rust:** `inherited_dimensions: &[ConstraintDimension]` — flat slice applied to all surfaces.

**Fix:** Change to `HashMap<String, Vec<ConstraintDimension>>` keyed by meaning ID.

### 3.7 Acceptable set always equals truth set (P2)

**TS:** Acceptable set could include carriers that failed hand conditions but passed encoding — used for teaching ("you could also bid X if you had Y").

**Rust:** Acceptable set is always identical to truth set.

**Fix:** Implement the hand-gate-failed-but-legal-encoding path in `classify_into_sets()`.

### 3.8 resolved_candidates always empty (P2)

**Rust:** `protocol_adapter.rs`: `resolved_candidates: Vec::new(), // TODO: build from pipeline carriers`.

**Fix:** Build from `truthSet + acceptableSet` with eligibility, failed conditions, encodings, band.

### 3.9 EvidenceBundle never populated (P3)

**Rust:** `meaning_arbitrator.rs`: `evidence_bundle: None`. The type exists but is never constructed.

**Fix:** Port `buildEvidenceBundleFromCarriers()`.

### 3.10 ExplanationCatalog not built (P3)

**Rust:** `StrategyEvaluation.explanation_catalog` is always `None`.

**Fix:** Build from `PLATFORM_EXPLANATION_ENTRIES` + module entries.

---

## 4. Service Layer & Session Management

### 4.1 Play recommendations always empty (P2)

**TS:** World-class advisor accumulated `PlayRecommendation[]` during play for the review phase.

**Rust:** `play_recommendations: Vec::new()` always.

**Fix:** Depends on MC+DDS play (section 5). Stub with heuristic recommendations until then.

### 4.2 ~~DDS always returns unavailable~~ (P2) ✅ COMPLETE

**Fixed:** Rust `get_dds_solution()` returns `DdsNotAvailable` stub, but `WasmService.getDDSSolution()` in `wasm-service.ts` transparently falls back to `getDDSSolutionFromWorker()` — the JS DDS Web Worker bridge. Callers get a real `DDSolutionResult` from the browser DDS solver. `getDealPBN()` service method provides the PBN string needed by the worker.

**Files:** `src/service/wasm-service.ts`, `src/service/dds-bridge.ts`

### 4.3 Evaluation methods all stubbed (P2)

**Rust:** `evaluateAtom`, `gradeAtom`, `startPlaythrough`, `getPlaythroughStep`, `gradePlaythroughBid` all return "not yet implemented" errors.

**Fix:** Port from TS `src/service/evaluation/`.

### 4.4 Debug types are untyped JSON (P3)

**TS:** `getDebugSnapshot`, `getDebugLog`, `getInferenceTimeline`, `getPlaySuggestions` returned typed structs.

**Rust:** All return `serde_json::Value`. Inference timeline and play suggestions are always empty.

**Fix:** Define typed structs matching the TS debug types.

### 4.5 getExpectedBid wrapping difference (P3)

**TS:** Returns `{ call: Call } | null`. **Rust:** Returns `Option<Call>`.

**Fix:** Align or handle in WASM proxy.

---

## 5. Heuristic Play & AI Behavior

### 5.1 ~~Monte Carlo + DDS play missing~~ (P1) ✅ COMPLETE

**Fixed:** `src/engine/mc-dds-play.ts` implements deal sampling (Fisher-Yates with constraint filtering), batched DDS evaluation (15 deals/batch, up to 2 batches), early termination when top-2 cards diverge ≥0.5 avg tricks, and close-call extension. `mcDdsSuggest()` is wired into `play-phase.svelte.ts`: profile dispatch checks `deps.useMcDds()` (Expert/WorldClass + DDS available), calls `mcDdsSuggest()` with belief-constrained remaining-card sampling, then executes the suggestion via `playSingleCard()` → `process_single_card()` in Rust. Expert samples randomly (no beliefs); WorldClass adds belief-constraint filtering via `PlayProfile.use_posterior`. Beginner/ClubPlayer profiles continue using the synchronous Rust heuristic chain via `playCard()`.

**Files:** `src/engine/mc-dds-play.ts`, `src/stores/play-phase.svelte.ts`, `src-tauri/crates/bridge-session/src/session/play_controller.rs` (`process_single_card`)

### 5.2 ~~Inference-aware play missing~~ (P1) ✅ COMPLETE

**Fixed:** `PlayContext` now has `beliefs: Option<PlayBeliefs>` with L1 ranges, L2 posterior HCP/suit-lengths, and confidence. Three heuristics are inference-aware (gated on confidence > 0.3):
- **opening_lead.rs**: NT — attack declarer's shortest posterior suit; Suit — lead through dummy's length, avoid declarer's short suits
- **mid_game_lead.rs**: Prefer suits where opponent pair's combined posterior length is shortest
- **discard.rs**: Tiebreaker favoring discards from suits where partner is short

`play_controller.rs` uses profile-based dispatch via `suggest_play_with_profile()` with deterministic per-seat RNG. `use_inferences` and `use_posterior` on `PlayProfile` are now active config.

### 5.3 Card counting and restricted choice missing (P1)

**TS:** Two expert-only heuristics defined inline in `profile-play-strategy.ts`: card counting (void detection from prior tricks) and restricted choice (Bayesian honor-play reasoning).

**Rust:** Neither exists.

**Impact:** Club Player+ profiles lose finesse-level play reasoning.

### 5.4 Pragmatic bidding generator missing (P2)

**TS:** Generated tactical candidates: conservative NT downgrade, competitive overcall (8+ HCP, 5+ suit), protective double (passout seat, 10+ HCP).

**Rust:** No pragmatic generator in the strategy chain.

**Files:** Was `src/session/heuristics/pragmatic-generator.ts`

**Impact:** AI bidding in competitive/tactical situations is less nuanced.

### 5.5 Strategy chain resultFilter missing (P2)

**TS:** Optional `resultFilter` predicate on the strategy chain could reject results (used for forcing-bid enforcement).

**Rust:** No filtering mechanism in `strategy_chain.rs`.

**Fix:** Add `result_filter: Option<Box<dyn Fn(&BidResult) -> bool>>` to chain.

### 5.6 Suit iteration order difference in heuristics (P3)

**TS:** `groupBySuit` used JS object property order (insertion order). **Rust:** `BTreeMap` with suit order key (C < D < H < S). When multiple suits tie on a heuristic criterion, Rust picks the lower suit, TS picks whichever appeared first in the hand array.

**Impact:** Different card selection in specific edge cases. Both results are reasonable.

---

## 6. Inference & Posterior

### 6.1 ~~Posterior engine is a stub~~ (P1) ✅ COMPLETE

**Fixed:** `PosteriorEngine` implements Monte Carlo rejection sampling (200-sample budget, 2000 max attempts) constrained by L1 `DerivedRanges` (HCP bounds, suit-length bounds, is_balanced). Query methods: `marginal_hcp()`, `suit_length()`, `fit_probability()`, `short_suit_probability()`, `confidence()`. `update_with_played_cards()` re-samples after each trick. `Posterior` enum dispatches between `UniformPosterior` (for profiles with `use_posterior=false`) and `PosteriorEngine` (for `use_posterior=true`).

**Files:** `bridge-session/src/inference/posterior.rs`

**Not ported (lower priority):** Factor graph compilation, latent branch resolution, joint HCP queries, posterior fact handlers. The rejection sampler covers the core use case (expected suit lengths and HCP for heuristic play decisions). Factor graph compilation would be needed for soft evidence / complex conditional queries.

### 6.2 Private belief conditioning missing (P2)

**TS:** `conditionOnOwnHand()` narrowed partner's public beliefs using own hand knowledge (cap partner HCP at `40 - own HCP`, cap suit length at `13 - own suit length`).

**Rust:** No equivalent. Partner range estimates don't account for observer's hand.

**Files:** Was `src/inference/private-belief.ts`

**Fix:** Port `conditionOnOwnHand()` — straightforward arithmetic on belief ranges.

### 6.3 Inference coordinator receives less data (P2)

**TS:** `processBid()` received full `BidResult` with meaning, public conditions, constraints.

**Rust:** `process_bid()` receives decomposed fields with `None` for meaning and `&[]` for constraints. Comment: "convention-level constraints not yet in Rust BidResult."

**Files:** `bridge-session/src/inference/inference_coordinator.rs`, called from `bridge-session/src/session/session_state.rs`

**Fix:** Pass `StrategyEvaluation` constraints through to the coordinator.

### 6.4 ~~Public belief state always null~~ (P3) ✅ COMPLETE

**Fixed:** `get_public_belief_state()` in `service_impl.rs` returns populated `ServicePublicBeliefState` by converting `session.state.public_belief_state` — holds `beliefs: HashMap<Seat, PublicBeliefs>` with HCP/suit ranges and `annotations: Vec<BidAnnotation>` with convention meanings and constraints. The inference coordinator populates these during bid processing.

---

## 7. Session Lifecycle & Drill Setup

### 7.1 ~~Practice focus always defaults~~ (P1) ✅ COMPLETE

**Fixed:** `derive_practice_focus()` in `practice_focus.rs` computes `target_module_ids`, `prerequisite_module_ids`, `follow_up_module_ids`, `background_module_ids` from bundle member ordering and target module. `StartDrillOptions` now accepts `target_module_id`, `bundle_member_ids`, and `bundle_deal_constraints`. When `target_module_id` is set, `start_drill()` calls `derive_practice_focus()` and populates `DrillBundle.practice_focus`.

### 7.2 ~~Initial auction always empty~~ (P1) ✅ COMPLETE

**Fixed:** `derive_initial_auction()` in `practice_focus.rs` uses hardcoded bundle-family recognition rules: balanced 15–17 HCP → 1NT, 5+ hearts → 1H, 5+ spades → 1S. Returns `None` for opener role or unrecognized constraints. Integrated into `start_drill()` when `target_module_id` is set.

### 7.3 No bid context resolution (P2)

**TS:** `resolveBidContext()` determined if a bid was target, prerequisite, follow-up, or off-convention based on practice focus.

**Rust:** No equivalent. `BiddingViewport` has no `bidContext` field.

**Fix:** Port `resolveBidContext()` and add field to viewport.

### 7.4 No biddingOptions in viewport (P2)

**TS:** `BiddingViewport` included `biddingOptions: BiddingOptionView[]` — active meaning surfaces shown during bidding.

**Rust:** Field absent from viewport.

**Fix:** Build from current surface groups in the convention machine.

### 7.5 Teaching weighting not ported (P3)

**TS:** `computeScenarioDistribution()` with 4 modes (positiveOnly, teachingDefault, balanced, adaptive) controlling deal generation mix.

**Rust:** No equivalent. Was noted as "not directly wired into deal generation yet" in TS — likely never active.

**Impact:** Low — was a prototype.

---

## 8. Debug Infrastructure

### 8.1 No debug logging in bidding controller (P2)

**TS:** Every user bid captured a `DebugSnapshot` with `expectedBid`, pipeline state, strategy evaluation. Pre-bid snapshots pushed when it became user's turn.

**Rust:** No `debug_log`, no `debug_turn_counter`, no `captureSnapshot()`. The `SessionState` struct has no debug fields.

**Impact:** Debug panel components (`DebugAtAGlance`, `DebugBidLog`, `DebugConventionMachine`, `DebugProvenance`, `DebugPublicBeliefs`) receive empty/null data.

**Fix:** Add debug log to `SessionState`, capture snapshots in bidding controller.

### 8.2 No strategy chain trace in BidResult (P3)

**TS:** `evaluationTrace` in `BidResult` carried `strategyChainPath`, `forcingFiltered`, `candidateCount`.

**Rust:** `BidResult` has no trace field. `ChainTrace` exists separately but isn't embedded.

**Fix:** Add trace field to `BidResult` or thread `ChainTrace` to the debug snapshot.

---

## Recommended Fix Order

### Wave 1 — P0 fixes (user-facing correctness)
1. ~~**1.1** Port 5-tier bid grading~~ ✅
2. **2.1** Add bid history to session state and viewports (unblocks auction display)
3. ~~**3.1** Port kernel delta advancement~~ ✅
4. ~~**3.2** Add relational context to pipeline~~ ✅

### Wave 2 — P1 fixes (feature fidelity)
5. **1.2, 1.3** Teaching detail and viewport feedback
6. **2.2** AI bid history entries
7. **3.3** Practical scoring alignment
8. **7.1, 7.2** Practice focus derivation and initial auction

### Wave 3 — P1 play quality (AI behavior)
9. ~~**5.2** Inference-aware play heuristics~~ ✅
10. **5.3** Card counting and restricted choice
11. ~~**6.1** Posterior engine (partial — start with rejection sampler)~~ ✅
12. ~~**5.1** MC+DDS play~~ ✅

### Wave 4 — P2/P3 (completeness)
13. Remaining P2 items (3.5–3.8, 4.1, 4.3–4.5, 5.4–5.5, 6.2–6.3, 7.3–7.4, 8.1)
14. P3 items as encountered

---

## Appendix: File Cross-Reference

| TS File (at commit 4890ba2) | Rust Equivalent | Status |
|---|---|---|
| `session/bid-feedback-builder.ts` | `bridge-session/session/bid_feedback_builder.rs` | 5-tier grading ✅ |
| `session/bidding-controller.ts` | `bridge-session/session/bidding_controller.rs` | Missing history, debug, teaching |
| `session/play-controller.ts` | `bridge-session/session/play_controller.rs` | Profile dispatch + beliefs wired ✅; MC+DDS via `process_single_card` ✅ |
| `session/session-state.ts` | `bridge-session/session/session_state.rs` | Missing many fields |
| `session/drill-session.ts` | `bridge-session/session/drill_session.rs` | Ported |
| `session/phase-machine.ts` | `bridge-session/phase_machine.rs` | Full parity |
| `session/phase-coordinator.ts` | `bridge-session/phase_coordinator.rs` | Full parity |
| `session/config-factory.ts` | `bridge-session/session/config_factory.rs` | Simplified |
| `session/start-drill.ts` | `bridge-session/session/start_drill.rs` | Missing focus, initial auction |
| `session/build-viewport.ts` | `bridge-session/session/build_viewport.rs` | Ported |
| `session/learning-viewport.ts` | `bridge-session/session/learning_viewport.rs` | Ported (minor gaps) |
| `session/flow-tree-builder.ts` | `bridge-session/session/flow_tree_builder.rs` | Ported |
| `session/format-obs-label.ts` | `bridge-session/session/format_obs_label.rs` | Ported (minor enum gaps) |
| `session/bid-context-resolver.ts` | — | **Missing** |
| `session/practice-focus.ts` | — | **Missing** (type exists, logic absent) |
| `session/teaching-weighting.ts` | — | **Missing** (was prototype) |
| `session/strategy-factory.ts` | — | **Missing** (partially elsewhere) |
| `session/dds-controller.ts` | — | **Missing** |
| `session/practice-preferences.ts` | — | N/A (localStorage concern) |
| `session/session-manager.ts` | `bridge-service/session_manager.rs` | Ported (moved to service) |
| `session/heuristics/montecarlo-play.ts` | `src/engine/mc-dds-play.ts` | ✅ Complete (TS-side MC+DDS with Rust `playSingleCard`) |
| `session/heuristics/inference-play.ts` | — | **Missing** |
| `session/heuristics/profile-play-strategy.ts` | — | **Missing** (partially absorbed) |
| `session/heuristics/pragmatic-generator.ts` | — | **Missing** |
| `session/heuristics/play-constraint-tracker.ts` | — | **Missing** |
| `session/heuristics/heuristic-play.ts` | `bridge-session/heuristics/heuristic_play.rs` | Ported (split into 3 files) |
| `session/heuristics/natural-fallback.ts` | `bridge-session/heuristics/natural_fallback.rs` | Full parity |
| `session/heuristics/pass-strategy.ts` | `bridge-session/heuristics/pass_strategy.rs` | Full parity |
| `session/heuristics/play-profiles.ts` | `bridge-session/heuristics/play_profiles.rs` | Ported (profile dispatch active, inference flags wired) |
| `session/heuristics/random-play.ts` | `bridge-session/heuristics/random_play.rs` | Full parity |
| `session/heuristics/strategy-chain.ts` | `bridge-session/heuristics/strategy_chain.rs` | Missing resultFilter, trace |
| `inference/posterior/` (10 files) | `bridge-session/inference/posterior.rs` | MC rejection sampler ✅ (factor graph/latent branch deferred) |
| `inference/private-belief.ts` | — | **Missing** |
| `conventions/adapter/protocol-adapter.ts` | `bridge-conventions/adapter/protocol_adapter.rs` | Kernel delta ✅, relational ctx ✅ |
| `conventions/adapter/meaning-strategy.ts` | `bridge-conventions/adapter/meaning_strategy.rs` | Ported (thinner) |
| `conventions/adapter/bid-result-builder.ts` | `bridge-service/convention_adapter.rs` | truth_set/acceptable_set wired ✅, kernel advancement ✅, relational ctx ✅ |
| `conventions/adapter/practical-scorer.ts` | `bridge-session/heuristics/practical_scorer.rs` | Different algorithm |
| `conventions/adapter/trace-collector.ts` | — | **Missing** |
| `service/local-service.ts` | `bridge-service/service_impl.rs` | Ported (many gaps above) |
| `service/port.ts` | `bridge-service/port.rs` | Ported (same methods) |
| `service/viewport-builders.ts` | `bridge-service/service_impl.rs` (inline) | Simplified |
| `service/response-types.ts` | `bridge-service/response_types.rs` | Missing fields noted above |
| `service/debug-types.ts` | — | Untyped `serde_json::Value` |
