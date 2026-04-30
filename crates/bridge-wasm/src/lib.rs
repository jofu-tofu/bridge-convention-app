use std::sync::Once;
use wasm_bindgen::prelude::*;

use bridge_engine::types::{Call, Card, Seat};
#[cfg(debug_assertions)]
use bridge_service::DevServicePort;
use bridge_service::{ServicePort, ServicePortImpl, SessionConfig};
use bridge_session::dds::{DdsError, McddParams, SolveBoardRequest, SolveBoardResponse};

// ── Tracing setup ───────────────────────────────────────────────

static TRACING_INIT: Once = Once::new();

/// Enable verbose tracing output (maps Rust `tracing` events to console.log).
/// Call once before running commands that need diagnostics. Idempotent.
#[wasm_bindgen]
pub fn set_verbose(max_level: &str) {
    let level = match max_level {
        "trace" => tracing::Level::TRACE,
        "debug" => tracing::Level::DEBUG,
        "warn" => tracing::Level::WARN,
        "error" => tracing::Level::ERROR,
        _ => tracing::Level::INFO,
    };
    TRACING_INIT.call_once(|| {
        let mut builder = tracing_wasm::WASMLayerConfigBuilder::new();
        builder.set_max_level(level);
        builder.set_report_logs_in_timings(false);
        tracing_wasm::set_as_global_default_with_config(builder.build());
    });
}

// ── Serialization helpers ─────────────────────────────────────────

fn to_js<T: serde::Serialize>(val: T) -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    val.serialize(&serializer)
        .map_err(|e| JsError::new(&e.to_string()))
}

fn from_js<T: serde::de::DeserializeOwned>(val: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))
}

fn service_error(err: bridge_service::ServiceError) -> JsError {
    JsError::new(&err.to_string())
}

// ── JS DDS solver wrapper ────────────────────────────────────────

/// Build a DdsSolverFn closure from a cloned js_sys::Function.
/// JS signature: (trump, first, trickSuit, trickRank, pbn) => Promise<{cards: [{suit, rank, score}]}>
fn make_js_solver(
    js_fn: js_sys::Function,
) -> impl FnMut(
    SolveBoardRequest,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<SolveBoardResponse, DdsError>>>,
> {
    move |req: SolveBoardRequest| {
        let this = JsValue::NULL;
        let trump = JsValue::from(req.trump);
        let first = JsValue::from(req.first);

        let trick_suit = js_sys::Array::new();
        for &s in &req.current_trick_suit {
            trick_suit.push(&JsValue::from(s));
        }
        let trick_rank = js_sys::Array::new();
        for &r in &req.current_trick_rank {
            trick_rank.push(&JsValue::from(r));
        }
        let pbn = JsValue::from_str(&req.remain_cards_pbn);

        let call_result =
            js_fn.call5(&this, &trump, &first, &trick_suit, &trick_rank, &pbn);

        Box::pin(async move {
            let promise =
                call_result.map_err(|e| DdsError::SolveFailed(format!("{:?}", e)))?;
            let js_result = wasm_bindgen_futures::JsFuture::from(js_sys::Promise::from(promise))
                .await
                .map_err(|e| DdsError::SolveFailed(format!("{:?}", e)))?;
            let response: SolveBoardResponse = serde_wasm_bindgen::from_value(js_result)
                .map_err(|e| DdsError::SolveFailed(e.to_string()))?;
            Ok(response)
        })
    }
}

use bridge_session::session::AiPlayEntry;

// ── WasmServicePort ───────────────────────────────────────────────

#[wasm_bindgen]
pub struct WasmServicePort {
    inner: ServicePortImpl,
    dds_solver: Option<js_sys::Function>,
    dds_table_solver: Option<js_sys::Function>,
}

#[wasm_bindgen]
impl WasmServicePort {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: ServicePortImpl::new(),
            dds_solver: None,
            dds_table_solver: None,
        }
    }

    /// Store a JS DDS per-card solver for MC+DDS play.
    pub fn set_dds_solver(&mut self, solver: js_sys::Function) {
        self.dds_solver = Some(solver);
    }

    /// Store a JS DDS table-level solver for full-deal analysis.
    /// JS signature: (pbn: string) => Promise<DDSolution>
    pub fn set_dds_table_solver(&mut self, solver: js_sys::Function) {
        self.dds_table_solver = Some(solver);
    }

    fn with_service<T>(
        &self,
        f: impl FnOnce(&ServicePortImpl) -> Result<T, bridge_service::ServiceError>,
    ) -> Result<T, JsError> {
        f(&self.inner).map_err(service_error)
    }

    fn with_service_mut<T>(
        &mut self,
        f: impl FnOnce(&mut ServicePortImpl) -> Result<T, bridge_service::ServiceError>,
    ) -> Result<T, JsError> {
        f(&mut self.inner).map_err(service_error)
    }

    // ── Session lifecycle ─────────────────────────────────────────

    pub fn create_drill_session(&mut self, config: JsValue) -> Result<JsValue, JsError> {
        let config: SessionConfig = from_js(config)?;
        self.with_service_mut(|service| service.create_drill_session(config))
            .and_then(to_js)
    }

    pub fn start_drill(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.start_drill(handle))
            .and_then(to_js)
    }

    // ── Bidding ───────────────────────────────────────────────────

    pub fn submit_bid(&mut self, handle: &str, call: JsValue) -> Result<JsValue, JsError> {
        let call: Call = from_js(call)?;
        self.with_service_mut(|service| service.submit_bid(handle, call))
            .and_then(to_js)
    }

    // ── Phase transitions ─────────────────────────────────────────

    pub fn enter_play(&mut self, handle: &str, seat_override: JsValue) -> Result<JsValue, JsError> {
        let seat_override: Option<Seat> = from_js(seat_override)?;
        self.with_service_mut(|service| service.enter_play(handle, seat_override))
            .and_then(to_js)
    }

    pub fn decline_play(&mut self, handle: &str) -> Result<(), JsError> {
        self.with_service_mut(|service| service.decline_play(handle))
    }

    pub fn return_to_prompt(&mut self, handle: &str) -> Result<(), JsError> {
        self.with_service_mut(|service| service.return_to_prompt(handle))
    }

    pub fn restart_play(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.restart_play(handle))
            .and_then(to_js)
    }

    // ── Play ──────────────────────────────────────────────────────

    /// Sync play path — heuristic AI profiles. Always available.
    pub fn play_card(
        &mut self,
        handle: &str,
        card: JsValue,
        seat: JsValue,
    ) -> Result<JsValue, JsError> {
        let card: Card = from_js(card)?;
        let seat: Seat = from_js(seat)?;
        self.with_service_mut(|service| service.play_card(handle, card, seat))
            .and_then(to_js)
    }

    /// Check if the current profile needs DDS-based play.
    pub fn needs_dds_play(&self, handle: &str) -> Result<bool, JsError> {
        let has_solver = self.dds_solver.is_some();
        if !has_solver {
            return Ok(false);
        }
        self.inner.needs_dds_play(handle).map_err(service_error)
    }

    /// Validate and apply the user's card. Returns the raw SingleCardResult
    /// so the caller can branch on accepted/play_complete.
    fn apply_user_card(
        &mut self,
        handle: &str,
        card: Card,
        seat: Seat,
    ) -> Result<bridge_session::session::SingleCardResult, JsError> {
        self.inner
            .apply_single_card(handle, card, seat)
            .map_err(service_error)
    }

    /// Run MC+DDS AI plays until it's the user's turn or play completes.
    /// Returns (ai_plays, Some(score)) if play finished, (ai_plays, None) otherwise.
    async fn run_ai_play_loop(
        &mut self,
        handle: &str,
        js_fn: &js_sys::Function,
    ) -> Result<(Vec<AiPlayEntry>, Option<Option<i32>>), JsError> {
        let mut ai_plays = Vec::new();

        loop {
            let ctx = self
                .inner
                .get_dds_play_context(handle)
                .map_err(service_error)?;
            let ctx = match ctx {
                Some(c) => c,
                None => break, // User's turn or play complete
            };

            let params = McddParams {
                seat: ctx.current_player,
                legal_plays: ctx.legal_plays,
                contract: ctx.contract,
                current_trick: ctx.current_trick,
                remaining_cards: ctx.remaining_cards,
                visible_seats: ctx.visible_seats,
                beliefs: ctx.beliefs,
            };

            let mut solver = make_js_solver(js_fn.clone());
            // Seed from session-derived (play_seed, trick, seat) offset so
            // seeded drill replay reproduces the same DDS decisions.
            let mut rng = <rand_chacha::ChaCha8Rng as rand::SeedableRng>::seed_from_u64(
                ctx.play_rng_seed,
            );
            let mc_result = bridge_session::dds::mc_dds_suggest(
                &params,
                ctx.use_constraints,
                &mut rng,
                &mut solver,
            )
            .await;

            let (ai_card, reason) = match mc_result {
                Some(result) => (result.best_card, result.reason),
                None => (params.legal_plays[0].clone(), "mc-dds:fallback".to_string()),
            };

            let ai_seat = ctx.current_player;
            let result = self
                .inner
                .apply_single_card(handle, ai_card.clone(), ai_seat)
                .map_err(service_error)?;

            ai_plays.push(AiPlayEntry {
                seat: ai_seat,
                card: ai_card,
                reason,
                trick_complete: result.trick_complete,
            });

            if result.play_complete {
                return Ok((ai_plays, Some(result.score)));
            }
        }

        Ok((ai_plays, None))
    }

    /// Async DDS play path — Expert/WorldClass profiles.
    /// Plays the user's card, then runs MC+DDS AI loop until user's turn.
    pub async fn play_card_dds(
        &mut self,
        handle: &str,
        card: JsValue,
        seat: JsValue,
    ) -> Result<JsValue, JsError> {
        let card: Card = from_js(card)?;
        let seat: Seat = from_js(seat)?;

        let js_fn = self
            .dds_solver
            .clone()
            .ok_or_else(|| JsError::new("DDS solver not set"))?;

        // 1. Play the user's card
        let user_result = self.apply_user_card(handle, card, seat)?;
        if !user_result.accepted {
            return to_js(bridge_session::session::PlayCardResult {
                accepted: false,
                trick_complete: false,
                play_complete: false,
                score: None,
                ai_plays: Vec::new(),
                legal_plays: None,
                current_player: None,
            });
        }
        if user_result.play_complete {
            return to_js(bridge_session::session::PlayCardResult {
                accepted: true,
                trick_complete: user_result.trick_complete,
                play_complete: true,
                score: user_result.score,
                ai_plays: Vec::new(),
                legal_plays: None,
                current_player: None,
            });
        }

        // 2. Run AI plays using MC+DDS until user's turn or play ends
        let (ai_plays, final_score) = self.run_ai_play_loop(handle, &js_fn).await?;

        if let Some(score) = final_score {
            return to_js(bridge_session::session::PlayCardResult {
                accepted: true,
                trick_complete: user_result.trick_complete,
                play_complete: true,
                score,
                ai_plays,
                legal_plays: None,
                current_player: None,
            });
        }

        let current_player = self
            .inner
            .get_dds_play_context(handle)
            .ok()
            .flatten()
            .map(|c| c.current_player);

        to_js(bridge_session::session::PlayCardResult {
            accepted: true,
            trick_complete: user_result.trick_complete,
            play_complete: false,
            score: None,
            ai_plays,
            legal_plays: None,
            current_player,
        })
    }

    pub fn skip_to_review(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.skip_to_review(handle))
            .and_then(to_js)
    }

    pub fn update_play_profile(
        &mut self,
        handle: &str,
        profile_id: &str,
    ) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.update_play_profile(handle, profile_id))
            .and_then(to_js)
    }

    // ── Query (viewport getters) ──────────────────────────────────

    pub fn get_bidding_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_bidding_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_declarer_prompt_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_declarer_prompt_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_playing_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_playing_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_explanation_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_explanation_viewport(handle))
            .and_then(to_js)
    }

    // ── Inference ─────────────────────────────────────────────────

    pub fn get_public_belief_state(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_public_belief_state(handle))
            .and_then(to_js)
    }

    // ── DDS ───────────────────────────────────────────────────────

    /// Async DDS table-level solve. Gets PBN from session state internally,
    /// calls the injected JS table solver. No PBN crosses the boundary.
    pub async fn get_dds_solution(&self, handle: &str) -> Result<JsValue, JsError> {
        let js_fn = match &self.dds_table_solver {
            Some(f) => f,
            None => {
                // No table solver — return "not available" stub
                return to_js(bridge_service::response_types::DDSolutionResult {
                    solution: None,
                    error: Some("DDS not available".to_string()),
                });
            }
        };

        // Get PBN from Rust state (no boundary crossing)
        let pbn = self.inner.get_deal_pbn(handle).map_err(service_error)?;

        // Call JS table solver: (pbn) => Promise<DDSolution>
        let this = JsValue::NULL;
        let pbn_js = JsValue::from_str(&pbn);
        let promise = js_fn
            .call1(&this, &pbn_js)
            .map_err(|e| JsError::new(&format!("DDS table solver call failed: {:?}", e)))?;

        let js_result = wasm_bindgen_futures::JsFuture::from(js_sys::Promise::from(promise))
            .await
            .map_err(|e| JsError::new(&format!("DDS table solve failed: {:?}", e)))?;

        // Wrap the raw DDSolution into DDSolutionResult
        let solution_json: serde_json::Value = serde_wasm_bindgen::from_value(js_result)
            .map_err(|e| JsError::new(&format!("DDS result deserialization failed: {}", e)))?;

        to_js(bridge_service::response_types::DDSolutionResult {
            solution: Some(solution_json),
            error: None,
        })
    }

    // ── Catalog ───────────────────────────────────────────────────

    pub fn list_conventions(&self) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.list_conventions()))
            .and_then(to_js)
    }

    pub fn list_modules(&self) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.list_modules()))
            .and_then(to_js)
    }

    // ── Learning ──────────────────────────────────────────────────

    pub fn get_module_learning_viewport(&self, module_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_module_learning_viewport(module_id)))
            .and_then(to_js)
    }

    pub fn get_bundle_flow_tree(&self, bundle_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_bundle_flow_tree(bundle_id)))
            .and_then(to_js)
    }

    pub fn get_module_flow_tree(&self, module_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_module_flow_tree(module_id)))
            .and_then(to_js)
    }

    // ── Workshop ─────────────────────────────────────────────────

    pub fn fork_module(&self, source_module_id: &str) -> Result<JsValue, JsError> {
        let json_str = self
            .inner
            .fork_module(source_module_id)
            .map_err(service_error)?;
        // Parse JSON string back to JsValue so it arrives as an object in JS
        let value: serde_json::Value =
            serde_json::from_str(&json_str).map_err(|e| JsError::new(&e.to_string()))?;
        to_js(value)
    }

    pub fn get_module_config_schema(
        &self,
        module_id: String,
        user_modules_json: JsValue,
    ) -> Result<JsValue, JsError> {
        let user_json: Option<String> =
            if user_modules_json.is_null() || user_modules_json.is_undefined() {
                None
            } else {
                Some(from_js(user_modules_json)?)
            };
        let result = self
            .inner
            .get_module_config_schema(&module_id, user_json.as_deref())
            .map_err(service_error)?;
        to_js(result)
    }

    pub fn validate_module(&self, module_json: JsValue) -> Result<JsValue, JsError> {
        let json: String = from_js(module_json)?;
        let result = self.inner.validate_module(&json).map_err(service_error)?;
        to_js(result)
    }
}

// ── DevServicePort methods (debug builds only) ────────────────────

#[cfg(debug_assertions)]
#[wasm_bindgen]
impl WasmServicePort {
    pub fn get_expected_bid(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_expected_bid(handle))
            .and_then(to_js)
    }

    pub fn get_debug_log(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_debug_log(handle))
            .and_then(to_js)
    }

    pub fn get_inference_timeline(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_inference_timeline(handle))
            .and_then(to_js)
    }

    pub fn get_convention_name(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_convention_name(handle))
            .and_then(to_js)
    }
}
