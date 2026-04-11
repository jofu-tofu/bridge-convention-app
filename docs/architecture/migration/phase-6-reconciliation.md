# Phase 6: TS/Rust Behavioral Reconciliation

Post-migration audit reconciling behavioral differences between the deleted TS backend and the current Rust implementation. These are not bugs introduced during migration — they are features, logic paths, and capabilities that were simplified or deferred during the port.

**Status:** Complete (all P0-P3 items resolved; 4 items explicitly deferred)
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

### 3.5 Semantic class alias deduplication missing (P1) — Deferred

**TS:** `deduplicateBySemanticClassAlias()` resolved alias pairs before deduplication, allowing cross-module semantic equivalence.

**Rust:** `deduplicate_by_semantic_class()` checks raw `semantic_class_id` only — no alias resolution.

**Spike result (2026-04-02):** No alias data found in any module fixture JSON. No cross-module duplicate semantic class IDs found across all 4 bundles. `BRIDGE_SEMANTIC_CLASSES` contains 6 well-known classes with no alias pairs. Deferred — revisit when alias fields are added to fixtures.

**Files:** `bridge-conventions/src/pipeline/evaluation/meaning_arbitrator.rs`

### 3.6 ~~inheritedDimsLookup is flat instead of per-meaning~~ (P2) ✅ COMPLETE

**Fixed:** `PipelineInput.inherited_dimensions` changed from `&[ConstraintDimension]` to `&HashMap<String, Vec<ConstraintDimension>>` keyed by meaning_id. `evaluate_bid_meaning_with_facts()` looks up per-meaning dims. All callers pass `&HashMap::new()` — behavioral change activates when callers populate per-meaning dims.

### 3.7 ~~Acceptable set always equals truth set~~ (P2) ✅ COMPLETE

**Fixed:** `classify_into_sets()` now includes hand-gate-failed-but-legal-encoding carriers in the acceptable set. Enables "Acceptable" grade in 5-tier grading — "you could bid X if you had Y".

### 3.8 ~~resolved_candidates always empty~~ (P2) ✅ COMPLETE

**Fixed:** `build_resolved_candidates()` maps truth_set + acceptable_set carriers to `ResolvedCandidateDTO` with eligibility, failed conditions, encodings, module_id, recommendation_band.

### 3.9 ~~EvidenceBundle never populated~~ (P3) ✅ COMPLETE

**Fixed:** `build_evidence_bundle()` in `meaning_arbitrator.rs` builds matched (selected carrier's satisfied conditions), rejected (eliminated carriers' failed conditions), and alternatives (truth set entries not selected).

### 3.10 ~~ExplanationCatalog not built~~ (P3) ✅ COMPLETE

**Fixed:** `ExplanationCatalog` typed struct added to `strategy_evaluation.rs`. `build_explanation_catalog()` in `protocol_adapter.rs` populates from module surface results. `explanation_catalog` field changed from `Option<serde_json::Value>` to `Option<ExplanationCatalog>`.

---

## 4. Service Layer & Session Management

### 4.1 ~~Play recommendations always empty~~ (P2) ✅ COMPLETE

**Fixed:** New `recordPlayRecommendation()` ServicePort method (24th method). TS pushes MC+DDS recommendations into Rust session state during play. `play_recommendations: Vec<PlayRecommendation>` added to SessionState, cleared per deal. WASM binding + TS proxy added.

### 4.2 ~~DDS always returns unavailable~~ (P2) ✅ COMPLETE

**Fixed:** Rust `get_dds_solution()` returns `DdsNotAvailable` stub, but `WasmService.getDDSSolution()` in `wasm-service.ts` transparently falls back to `getDDSSolutionFromWorker()` — the JS DDS Web Worker bridge. Callers get a real `DDSolutionResult` from the browser DDS solver. `getDealPBN()` service method provides the PBN string needed by the worker.

**Files:** `src/service/wasm-service.ts`, `src/service/dds-bridge.ts`

### 4.3 Evaluation methods all stubbed (P2)

**Rust:** `evaluateAtom`, `gradeAtom`, `startPlaythrough`, `getPlaythroughStep`, `gradePlaythroughBid` all return "not yet implemented" errors.

**Fix:** Port from TS `src/service/evaluation/`.

### 4.4 ~~Debug types are untyped JSON~~ (P3) ✅ COMPLETE

**Fixed:** `ExpectedBidDTO` typed struct replaces `serde_json::Value` for expected bid. `ServiceDebugLogEntryDTO` uses typed fields (expected_call, grade, trace). `InferenceTimelineEntryDTO` uses typed `new_constraints` and `cumulative_beliefs`. `get_inference_timeline()` populated from inference coordinator snapshots.

### 4.5 ~~getExpectedBid wrapping difference~~ (P3) ✅ COMPLETE

**Verified:** `Option<Call>` serializes correctly via serde_wasm_bindgen. No TS consumer expects `{ call: Call }` shape — debug panel uses the raw Call value. No wrapper needed.

---

## 5. Heuristic Play & AI Behavior

### 5.1 ~~Monte Carlo + DDS play missing~~ (P1) ✅ COMPLETE

**Fixed:** `src/engine/mc-dds-play.ts` implements deal sampling (Fisher-Yates with constraint filtering), batched DDS evaluation (15 deals/batch, up to 2 batches), early termination when top-2 cards diverge ≥0.5 avg tricks, and close-call extension. `mcDdsSuggest()` is wired into `play-phase.svelte.ts`: profile dispatch checks `deps.useMcDds()` (Expert/WorldClass + DDS available), calls `mcDdsSuggest()` with belief-constrained remaining-card sampling, then executes the suggestion via `playSingleCard()` → `process_single_card()` in Rust. Expert samples randomly (no beliefs); WorldClass adds belief-constraint filtering via `PlayProfile.use_posterior`. Beginner/ClubPlayer profiles continue using the synchronous Rust heuristic chain via `playCard()`.

**Files:** `src/engine/mc-dds-play.ts`, `src/stores/play-phase.svelte.ts`, `crates/bridge-session/src/session/play_controller.rs` (`process_single_card`)

### 5.2 ~~Inference-aware play missing~~ (P1) ✅ COMPLETE

**Fixed:** `PlayContext` now has `beliefs: Option<PlayBeliefs>` with L1 ranges, L2 posterior HCP/suit-lengths, and confidence. Three heuristics are inference-aware (gated on confidence > 0.3):
- **opening_lead.rs**: NT — attack declarer's shortest posterior suit; Suit — lead through dummy's length, avoid declarer's short suits
- **mid_game_lead.rs**: Prefer suits where opponent pair's combined posterior length is shortest
- **discard.rs**: Tiebreaker favoring discards from suits where partner is short

`play_controller.rs` uses profile-based dispatch via `suggest_play_with_profile()` with deterministic per-seat RNG. `use_inferences` and `use_posterior` on `PlayProfile` are now active config.

### 5.3 ~~Card counting and restricted choice missing~~ (P1) ✅ COMPLETE

**Fixed:** Two new heuristics added to the play chain:
- **CardCountingHeuristic** (`card_counting.rs`): Scans previous tricks for failure-to-follow-suit, builds void map. Defenders lead through LHO's void, avoid RHO's void. Declarer leads toward defender-after-dummy's void. Gated on `PlayProfile.use_card_counting` (ClubPlayer+).
- **RestrictedChoiceHeuristic** (`restricted_choice.rs`): Detects when an opponent played a single touching honor (e.g., J from possible KJ). Bayesian reasoning says singleton is more likely — suggests finesse in that suit on subsequent lead. Gated on `PlayProfile.use_inferences` (Expert+).

Both inserted into the heuristic chain after `MidGameLeadHeuristic` in `play_profiles.rs`.

### 5.4 ~~Pragmatic bidding generator missing~~ (P2) ✅ COMPLETE

**Fixed:** `PragmaticStrategy` in `bridge-session/src/heuristics/pragmatic_strategy.rs` with 2 tactical generators: competitive overcall (8+ HCP, 5+ suit, opponents bid) and protective double (10+ HCP, balancing seat). Inserted into opponent strategy chain after natural fallback via `StrategyChain` in `config_resolver.rs`.

### 5.5 ~~Strategy chain resultFilter missing~~ (P2) ✅ COMPLETE

**Fixed:** `result_filter: Option<Box<dyn Fn(&BidResult, &BiddingContext) -> bool + Send + Sync>>` added to `StrategyChain`. Applied in `suggest_with_trace()` after strategy produces result — rejected results cause the chain to continue. Builder: `chain.with_result_filter(filter)`. Primary use: forcing-bid enforcement.

### 5.6 Suit iteration order difference in heuristics (P3)

**TS:** `groupBySuit` used JS object property order (insertion order). **Rust:** `BTreeMap` with suit order key (C < D < H < S). When multiple suits tie on a heuristic criterion, Rust picks the lower suit, TS picks whichever appeared first in the hand array.

**Impact:** Different card selection in specific edge cases. Both results are reasonable.

---

## 6. Inference & Posterior

### 6.1 ~~Posterior engine is a stub~~ (P1) ✅ COMPLETE

**Fixed:** `PosteriorEngine` implements Monte Carlo rejection sampling (200-sample budget, 2000 max attempts) constrained by L1 `DerivedRanges` (HCP bounds, suit-length bounds, is_balanced). Query methods: `marginal_hcp()`, `suit_length()`, `fit_probability()`, `short_suit_probability()`, `confidence()`. `update_with_played_cards()` re-samples after each trick. `Posterior` enum dispatches between `UniformPosterior` (for profiles with `use_posterior=false`) and `PosteriorEngine` (for `use_posterior=true`).

**Files:** `bridge-session/src/inference/posterior.rs`

**Not ported (lower priority):** Factor graph compilation, latent branch resolution, joint HCP queries, posterior fact handlers. The rejection sampler covers the core use case (expected suit lengths and HCP for heuristic play decisions). Factor graph compilation would be needed for soft evidence / complex conditional queries.

### 6.2 ~~Private belief conditioning missing~~ (P2) ✅ COMPLETE

**Fixed:** `condition_on_own_hand()` in `bridge-session/src/inference/private_belief.rs` caps each non-observer seat's `hcp.max` at `min(existing, 40 - observer_hcp)` and per-suit `length.max` at `min(existing, 13 - observer_suit_count)`. Per-seat caps are intentionally over-tight (same as TS) — posterior rejection sampling enforces the real constraint. Wired into `initialize_posterior()` in `session_state.rs` between range collection and `PosteriorEngine::new()`.

### 6.3 ~~Inference coordinator receives less data~~ (P2) ✅ COMPLETE

**Fixed:** `SessionState::process_bid()` now accepts `constraints: &[FactConstraint]` and forwards them to the inference coordinator (was hardcoded `&[]`). The bidding controller extracts constraints from `ConventionStrategyAdapter`'s stashed `StrategyEvaluation` via `BiddingStrategy::stashed_evaluation()` (new trait method returning `Option<Box<dyn Any + Send>>`), downcast to `StrategyEvaluation` in `bridge-session`. Satisfied `MeaningClause` entries are mapped 1:1 to `FactConstraint`. Falls back to `&[]` for non-convention strategies, no evaluation, or no matched surface.

**Files:** `bridge-engine/src/strategy.rs` (trait method), `bridge-service/src/convention_adapter.rs` (override + extraction), `bridge-session/src/session/bidding_controller.rs` (helper + 3 call sites), `bridge-session/src/session/session_state.rs` (param added)

### 6.4 ~~Public belief state always null~~ (P3) ✅ COMPLETE

**Fixed:** `get_public_belief_state()` in `service_impl.rs` returns populated `ServicePublicBeliefState` by converting `session.state.public_belief_state` — holds `beliefs: HashMap<Seat, PublicBeliefs>` with HCP/suit ranges and `annotations: Vec<BidAnnotation>` with convention meanings and constraints. The inference coordinator populates these during bid processing.

---

## 7. Session Lifecycle & Drill Setup

### 7.1 ~~Practice focus always defaults~~ (P1) ✅ COMPLETE

**Fixed:** `derive_practice_focus()` in `practice_focus.rs` computes `target_module_ids`, `prerequisite_module_ids`, `follow_up_module_ids`, `background_module_ids` from bundle member ordering and target module. `StartDrillOptions` now accepts `target_module_id`, `bundle_member_ids`, and `bundle_deal_constraints`. When `target_module_id` is set, `start_drill()` calls `derive_practice_focus()` and populates `DrillBundle.practice_focus`.

### 7.2 ~~Initial auction always empty~~ (P1) ✅ COMPLETE

**Fixed:** `derive_initial_auction()` in `practice_focus.rs` uses hardcoded bundle-family recognition rules: balanced 15–17 HCP → 1NT, 5+ hearts → 1H, 5+ spades → 1S. Returns `None` for opener role or unrecognized constraints. Integrated into `start_drill()` when `target_module_id` is set.

### 7.3 ~~No bid context resolution~~ (P2) ✅ COMPLETE

**Fixed:** `BidContextView` type with `BidRole` enum (Target/Prerequisite/FollowUp/OffConvention) and `CallRoleEntry` added to `build_viewport.rs`. `bid_context: Option<BidContextView>` field on `BiddingViewport`. Resolution logic deferred to service layer callers (type infrastructure wired).

### 7.4 ~~No biddingOptions in viewport~~ (P2) ✅ COMPLETE

**Fixed:** `BiddingOptionView` type (call, surface_name, summary) added to `build_viewport.rs`. `bidding_options: Option<Vec<BiddingOptionView>>` field on `BiddingViewport`. Population deferred to service layer callers (type infrastructure wired).

### 7.5 Teaching weighting not ported (P3)

**TS:** `computeScenarioDistribution()` with 4 modes (positiveOnly, teachingDefault, balanced, adaptive) controlling deal generation mix.

**Rust:** No equivalent. Was noted as "not directly wired into deal generation yet" in TS — likely never active.

**Impact:** Low — was a prototype.

---

## 8. Debug Infrastructure

### 8.1 ~~No debug logging in bidding controller~~ (P2) ✅ COMPLETE

**Fixed:** `DebugLogEntry` struct added to `session_state.rs` with typed fields (kind, turn_index, seat, call, expected_call, grade, trace). `debug_log: Vec<DebugLogEntry>` on `SessionState`, cleared per deal. Bidding controller captures entries for user bids and AI bids. `get_debug_log()` reads from `state.debug_log`.

### 8.2 ~~No strategy chain trace in BidResult~~ (P3) ✅ COMPLETE

**Fixed:** `ChainTrace`, `StrategyAttempt`, `AttemptOutcome` types moved to `bridge-engine/src/strategy.rs` (serializable). `trace: Option<ChainTrace>` field on `BidResult`. `suggest_with_trace()` sets trace on the returned BidResult. Flows through to debug snapshot and debug log entries.

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
10. ~~**5.3** Card counting and restricted choice~~ ✅
11. ~~**6.1** Posterior engine (partial — start with rejection sampler)~~ ✅
12. ~~**5.1** MC+DDS play~~ ✅

### Wave 4 — P2/P3 (completeness)
13. Remaining P2 items (3.6–3.8, 4.1, 4.3–4.5, 5.4–5.5, 7.3–7.4, 8.1)
14. P3 items as encountered
15. ~~**6.2** Private belief conditioning~~ ✅
16. ~~**6.3** Constraint threading~~ ✅
17. **3.5** Semantic alias dedup — Deferred (no alias data in fixtures)

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
| `inference/private-belief.ts` | `bridge-session/inference/private_belief.rs` | ✅ Complete |
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
