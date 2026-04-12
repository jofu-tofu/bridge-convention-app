//! ServicePortImpl — main implementation of ServicePort and DevServicePort.
//!
//! Wraps a SessionManager and delegates to bridge-session controllers.
//! Config resolution and bundle lookup are delegated to config_resolver
//! and bundle_resolver respectively.

use std::collections::{HashMap, HashSet};

use bridge_conventions::types::meaning::{ConstraintValue, FactOperator};
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::BaseSystemId;
use bridge_engine::constants::{partner_seat, SEATS};
use bridge_engine::strategy::BiddingStrategy;
use bridge_engine::types::{Call, Card, Seat};
use bridge_session::session::{
    build_bidding_viewport, build_bundle_flow_tree, build_declarer_prompt_viewport,
    build_explanation_viewport, build_module_catalog, build_module_flow_tree,
    build_module_learning_viewport, build_playing_viewport, format_call, process_bid,
    process_play_card, run_initial_ai_bids, run_initial_ai_plays, AiPlayEntry, BiddingViewport,
    BuildBiddingViewportInput, BuildDeclarerPromptViewportInput, BuildExplanationViewportInput,
    BuildPlayingViewportInput, BundleFlowTreeViewport, DeclarerPromptViewport, ExplanationViewport,
    ModuleCatalogEntry, ModuleFlowTreeViewport, ModuleLearningViewport, PlayCardResult,
    PlayingViewport, SeatStrategy,
};
use bridge_session::types::{GamePhase, PromptMode};

use crate::bundle_resolver;
use crate::error::ServiceError;
use crate::port::{DevServicePort, ServicePort};
use crate::request_types::{DrillHandle, SessionConfig};
use crate::response_types::{
    AiBidEntryDTO, AiPlayEntryDTO, BidSubmitResult, ConventionInfo, DDSolutionResult,
    DrillStartResult, InferenceTimelineEntryDTO, PhaseTransition, PlayEntryResult,
    ServiceDebugLogEntryDTO, ServiceFactConstraintDTO, ServicePublicBeliefState,
    ServicePublicBeliefsDTO,
};
use crate::session_manager::SessionManager;

fn user_face_up_seats(user_seat: Seat) -> HashSet<Seat> {
    let mut seats = HashSet::new();
    seats.insert(user_seat);
    seats
}

fn ai_play_dtos(ai_plays: Vec<AiPlayEntry>) -> Option<Vec<AiPlayEntryDTO>> {
    let dtos: Vec<AiPlayEntryDTO> = ai_plays.into_iter().map(AiPlayEntryDTO::from).collect();
    if dtos.is_empty() {
        None
    } else {
        Some(dtos)
    }
}

fn build_bidding_viewport_for_session(
    session: &crate::session_manager::ActiveSession,
) -> BiddingViewport {
    let face_up_seats = user_face_up_seats(session.state.user_seat);
    let current_turn = bridge_session::session::get_current_turn(
        &session.state.auction,
        session.state.deal.dealer,
    );
    let current_bidder = current_turn.unwrap_or(session.state.user_seat);
    let is_user_turn = session.state.is_user_seat(current_bidder);

    build_bidding_viewport(BuildBiddingViewportInput {
        deal: &session.state.deal,
        user_seat: session.state.user_seat,
        auction: &session.state.auction,
        bid_history: &session.state.bid_history,
        legal_calls: &session.state.legal_calls,
        face_up_seats: &face_up_seats,
        convention_name: session.state.convention_name.clone(),
        is_user_turn,
        current_bidder,
        practice_mode: Some(session.state.practice_mode),
        bid_context: None,
        bidding_options: None,
    })
}

fn initial_ai_play_dtos(
    session: &mut crate::session_manager::ActiveSession,
) -> Option<Vec<AiPlayEntryDTO>> {
    ai_play_dtos(run_initial_ai_plays(&mut session.state))
}

fn initialize_play_phase(session: &mut crate::session_manager::ActiveSession) -> PlayEntryResult {
    if let Some(ref contract) = session.state.contract {
        let contract = contract.clone();
        session.state.initialize_play(&contract);
        session.state.phase = GamePhase::Playing;
        PlayEntryResult {
            phase: session.state.phase,
            ai_plays: initial_ai_play_dtos(session),
        }
    } else {
        // Passout — skip to explanation
        session.state.phase = GamePhase::Explanation;
        PlayEntryResult {
            phase: session.state.phase,
            ai_plays: None,
        }
    }
}

// ── Config schema helpers ─────────────────────────────────────────

/// Resolve a module by ID, supporting both system and user modules.
fn resolve_module_for_schema(
    module_id: &str,
    user_modules_json: Option<&str>,
) -> Result<
    (
        ConventionModule,
        crate::config_schema_types::ModuleOwnership,
    ),
    ServiceError,
> {
    use crate::config_schema_types::ModuleOwnership;

    if module_id.starts_with("user:") {
        let json = user_modules_json.ok_or_else(|| {
            ServiceError::ModuleNotFound(format!(
                "User module '{}' requires user_modules_json",
                module_id
            ))
        })?;
        // user_modules_json is a JSON array of modules; find the one with matching ID
        let modules: Vec<ConventionModule> = serde_json::from_str(json)
            .map_err(|e| ServiceError::Internal(format!("Failed to parse user modules: {}", e)))?;
        let module = modules
            .into_iter()
            .find(|m| m.module_id == module_id)
            .ok_or_else(|| {
                ServiceError::ModuleNotFound(format!("User module '{}' not found", module_id))
            })?;
        Ok((module, ModuleOwnership::User))
    } else {
        use bridge_conventions::registry::module_registry::get_module;
        let module = get_module(module_id, BaseSystemId::Sayc).ok_or_else(|| {
            ServiceError::ModuleNotFound(format!("Module '{}' not found", module_id))
        })?;
        Ok((module.clone(), ModuleOwnership::System))
    }
}

/// Infer a valid range from a fact_id.
fn infer_valid_range(fact_id: &str) -> Option<crate::config_schema_types::ValidRange> {
    if fact_id.contains("hcp") || fact_id.contains("points") || fact_id.contains("tp") {
        Some(crate::config_schema_types::ValidRange { min: 0, max: 40 })
    } else if fact_id.contains("length") || fact_id.contains("count") {
        Some(crate::config_schema_types::ValidRange { min: 0, max: 13 })
    } else {
        None
    }
}

/// Extract an i32 from a ConstraintValue::Number if possible.
fn constraint_value_as_i32(value: &ConstraintValue) -> Option<i32> {
    match value {
        ConstraintValue::Number(n) => n.as_i64().map(|v| v as i32),
        _ => None,
    }
}

/// Convert a ConstraintValue to a ParameterValue.
fn to_parameter_value(
    value: &ConstraintValue,
) -> Option<(
    crate::config_schema_types::ParameterValue,
    crate::config_schema_types::ParameterType,
)> {
    use crate::config_schema_types::{ParameterType, ParameterValue};
    match value {
        ConstraintValue::Number(n) => {
            let i = n.as_i64().map(|v| v as i32)?;
            Some((ParameterValue::Integer(i), ParameterType::Integer))
        }
        ConstraintValue::Bool(b) => Some((ParameterValue::Boolean(*b), ParameterType::Boolean)),
        _ => None,
    }
}

/// Build configurable surfaces from a module's states.
fn build_configurable_surfaces(
    module: &ConventionModule,
) -> Vec<crate::config_schema_types::ConfigurableSurfaceView> {
    let states = match &module.states {
        Some(s) => s,
        None => return Vec::new(),
    };

    let mut surfaces = Vec::new();

    for state in states {
        for surface in &state.surfaces {
            let mut parameters = Vec::new();

            for (idx, clause) in surface.clauses.iter().enumerate() {
                // Skip system-controlled clauses
                if clause.fact_id.starts_with("system.") {
                    continue;
                }

                let (current_value, value_type) = match to_parameter_value(&clause.value) {
                    Some(pair) => pair,
                    None => continue, // Skip non-configurable value types (Range, List, String)
                };

                let description = clause
                    .description
                    .clone()
                    .unwrap_or_else(|| format!("{} {:?}", clause.fact_id, clause.operator));

                let valid_range = infer_valid_range(&clause.fact_id);

                parameters.push(crate::config_schema_types::ConfigurableParameter {
                    clause_index: idx,
                    fact_id: clause.fact_id.clone(),
                    description,
                    current_value,
                    default_value: None,
                    value_type,
                    valid_range,
                });
            }

            let disclosure_str = serde_json::to_value(&surface.disclosure)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| "natural".to_string());

            surfaces.push(crate::config_schema_types::ConfigurableSurfaceView {
                meaning_id: surface.meaning_id.clone(),
                name: surface.teaching_label.name.as_str().to_string(),
                summary: surface.teaching_label.summary.as_str().to_string(),
                call_display: format_call(&surface.encoding.default_call),
                disclosure: disclosure_str,
                parameters,
            });
        }
    }

    surfaces
}

/// Validate a module's content, returning any errors.
fn validate_module_content(
    module: &ConventionModule,
) -> Vec<crate::config_schema_types::ValidationError> {
    use crate::config_schema_types::ValidationError;

    let mut errors = Vec::new();

    // Display name must be non-empty
    if module.display_name.trim().is_empty() {
        errors.push(ValidationError {
            field: "displayName".to_string(),
            message: "Display name must not be empty".to_string(),
        });
    }

    // Must have at least one surface
    let has_surfaces = module
        .states
        .as_ref()
        .is_some_and(|states| states.iter().any(|s| !s.surfaces.is_empty()));

    if !has_surfaces {
        errors.push(ValidationError {
            field: "states".to_string(),
            message: "Module must have at least one surface".to_string(),
        });
    }

    // Validate clause values
    if let Some(states) = &module.states {
        for (si, state) in states.iter().enumerate() {
            for (surf_i, surface) in state.surfaces.iter().enumerate() {
                let path_prefix = format!("states[{}].surfaces[{}]", si, surf_i);

                // Collect gte/lte pairs per fact_id for range consistency
                let mut gte_values: HashMap<String, (usize, i32)> = HashMap::new();
                let mut lte_values: HashMap<String, (usize, i32)> = HashMap::new();

                for (ci, clause) in surface.clauses.iter().enumerate() {
                    let clause_path = format!("{}.clauses[{}]", path_prefix, ci);

                    // Validate numeric ranges
                    if let Some(val) = constraint_value_as_i32(&clause.value) {
                        let fact = &clause.fact_id;

                        if fact.contains("hcp") || fact.contains("points") || fact.contains("tp") {
                            if !(0..=40).contains(&val) {
                                errors.push(ValidationError {
                                    field: clause_path.clone(),
                                    message: format!(
                                        "Value {} for '{}' outside valid range 0-40",
                                        val, fact
                                    ),
                                });
                            }
                        } else if fact.contains("length") || fact.contains("count") {
                            if !(0..=13).contains(&val) {
                                errors.push(ValidationError {
                                    field: clause_path.clone(),
                                    message: format!(
                                        "Value {} for '{}' outside valid range 0-13",
                                        val, fact
                                    ),
                                });
                            }
                        }

                        // Track gte/lte for consistency check
                        match clause.operator {
                            FactOperator::Gte => {
                                gte_values.insert(fact.clone(), (ci, val));
                            }
                            FactOperator::Lte => {
                                lte_values.insert(fact.clone(), (ci, val));
                            }
                            _ => {}
                        }
                    }
                }

                // Check gte <= lte for same fact
                for (fact_id, (_gte_idx, gte_val)) in &gte_values {
                    if let Some((_lte_idx, lte_val)) = lte_values.get(fact_id) {
                        if gte_val > lte_val {
                            errors.push(ValidationError {
                                field: format!("{}.clauses", path_prefix),
                                message: format!(
                                    "Range error for '{}': gte ({}) > lte ({})",
                                    fact_id, gte_val, lte_val
                                ),
                            });
                        }
                    }
                }
            }
        }
    }

    errors
}

// ── ServicePortImpl ───────────────────────────────────────────────

/// Main implementation of ServicePort.
pub struct ServicePortImpl {
    manager: SessionManager,
}

impl ServicePortImpl {
    /// Create a new service port with an empty session manager.
    pub fn new() -> Self {
        Self {
            manager: SessionManager::new(),
        }
    }
}

impl Default for ServicePortImpl {
    fn default() -> Self {
        Self::new()
    }
}

// ── ServicePort implementation ────────────────────────────────────

impl ServicePort for ServicePortImpl {
    // ── Session lifecycle ──────────────────────────────────────────

    fn create_drill_session(&mut self, config: SessionConfig) -> Result<DrillHandle, ServiceError> {
        let setup = crate::drill_setup::build_drill_setup(&config)?;

        let handle = self
            .manager
            .create(setup.state, setup.drill_config, setup.seat_strategies);

        Ok(handle)
    }

    fn start_drill(&mut self, handle: &str) -> Result<DrillStartResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;

        // Run initial AI bids
        let ai_bids = run_initial_ai_bids(&mut session.state, &session.seat_strategies);

        let viewport = build_bidding_viewport_for_session(session);

        let auction_complete = session.state.auction.is_complete;
        let phase = session.state.phase;
        let practice_mode = session.state.practice_mode;
        let play_preference = session.state.play_preference;
        let is_off_convention = session.state.is_off_convention;

        Ok(DrillStartResult {
            viewport,
            is_off_convention,
            ai_bids: ai_bids.into_iter().map(AiBidEntryDTO::from).collect(),
            auction_complete,
            phase,
            practice_mode,
            play_preference,
        })
    }

    // ── Bidding ────────────────────────────────────────────────────

    fn submit_bid(&mut self, handle: &str, call: Call) -> Result<BidSubmitResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;

        if session.state.phase != GamePhase::Bidding {
            return Err(ServiceError::WrongPhase);
        }

        let result = process_bid(&mut session.state, call, &session.seat_strategies);

        // Build next viewport if accepted
        let next_viewport = if result.accepted {
            Some(build_bidding_viewport_for_session(session))
        } else {
            None
        };

        let phase_transition = result
            .phase_transition
            .map(|(from, to)| PhaseTransition { from, to });

        let grade = result.feedback.as_ref().map(|f| f.grade);

        // Retrieve stashed evaluation for rich feedback assembly
        let evaluation =
            Self::get_convention_adapter(session).and_then(|adapter| adapter.last_evaluation());

        let (viewport_feedback, teaching) = match &result.feedback {
            Some(fb) => {
                let vf =
                    crate::feedback_assembler::assemble_viewport_feedback(fb, evaluation.as_ref());
                let td =
                    crate::feedback_assembler::assemble_teaching_detail(fb, evaluation.as_ref());
                (Some(vf), td)
            }
            None => (None, None),
        };

        Ok(BidSubmitResult {
            accepted: result.accepted,
            grade,
            feedback: viewport_feedback,
            teaching,
            ai_bids: result
                .ai_bids
                .into_iter()
                .map(AiBidEntryDTO::from)
                .collect(),
            next_viewport,
            phase_transition,
            user_history_entry: result.user_history_entry,
        })
    }

    // ── Phase transitions ──────────────────────────────────────────

    fn enter_play(
        &mut self,
        handle: &str,
        seat_override: Option<Seat>,
    ) -> Result<PlayEntryResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;
        if let Some(seat) = seat_override {
            session.state.effective_user_seat = Some(seat);
        }
        Ok(initialize_play_phase(session))
    }

    fn decline_play(&mut self, handle: &str) -> Result<(), ServiceError> {
        let session = self.manager.get_mut(handle)?;
        session.state.phase = GamePhase::Explanation;
        Ok(())
    }

    fn return_to_prompt(&mut self, handle: &str) -> Result<(), ServiceError> {
        let session = self.manager.get_mut(handle)?;
        session.state.phase = GamePhase::DeclarerPrompt;
        Ok(())
    }

    fn restart_play(&mut self, handle: &str) -> Result<PlayEntryResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;
        session.state.play = bridge_session::session::PlayState::default();
        Ok(initialize_play_phase(session))
    }

    // ── Play ───────────────────────────────────────────────────────

    fn play_card(
        &mut self,
        handle: &str,
        card: Card,
        seat: Seat,
    ) -> Result<PlayCardResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;

        if session.state.phase != GamePhase::Playing {
            return Err(ServiceError::WrongPhase);
        }

        let result = process_play_card(&mut session.state, card, seat);
        Ok(result)
    }

    fn skip_to_review(&mut self, handle: &str) -> Result<(), ServiceError> {
        let session = self.manager.get_mut(handle)?;

        if session.state.phase != GamePhase::Playing {
            return Err(ServiceError::WrongPhase);
        }

        session.state.phase = GamePhase::Explanation;
        Ok(())
    }

    fn update_play_profile(&mut self, handle: &str, profile_id: &str) -> Result<(), ServiceError> {
        let session = self.manager.get_mut(handle)?;
        let id: bridge_session::heuristics::play_profiles::PlayProfileId =
            serde_json::from_value(serde_json::Value::String(profile_id.to_string()))
                .map_err(|_| ServiceError::Internal(format!("Unknown profile: {}", profile_id)))?;
        session.state.play_profile_id = id;
        Ok(())
    }

    // ── Query (viewport getters) ───────────────────────────────────

    fn get_bidding_viewport(&self, handle: &str) -> Result<Option<BiddingViewport>, ServiceError> {
        let session = self.manager.get(handle)?;

        if session.state.phase != GamePhase::Bidding {
            return Ok(None);
        }

        let face_up_seats = {
            let mut s = HashSet::new();
            s.insert(session.state.user_seat);
            s
        };
        let current_turn = bridge_session::session::get_current_turn(
            &session.state.auction,
            session.state.deal.dealer,
        );
        let current_bidder = current_turn.unwrap_or(session.state.user_seat);
        let is_user_turn = session.state.is_user_seat(current_bidder);

        let viewport = build_bidding_viewport(BuildBiddingViewportInput {
            deal: &session.state.deal,
            user_seat: session.state.user_seat,
            auction: &session.state.auction,
            bid_history: &session.state.bid_history,
            legal_calls: &session.state.legal_calls,
            face_up_seats: &face_up_seats,
            convention_name: session.state.convention_name.clone(),
            is_user_turn,
            current_bidder,
            practice_mode: Some(session.state.practice_mode),
            bid_context: None,
            bidding_options: None,
        });

        Ok(Some(viewport))
    }

    fn get_declarer_prompt_viewport(
        &self,
        handle: &str,
    ) -> Result<Option<DeclarerPromptViewport>, ServiceError> {
        let session = self.manager.get(handle)?;

        if session.state.phase != GamePhase::DeclarerPrompt {
            return Ok(None);
        }

        let contract = match &session.state.contract {
            Some(c) => c.clone(),
            None => return Ok(None),
        };

        // Compute prompt mode dynamically based on declarer/user seat relationship
        let user_seat = session.state.user_seat;
        let prompt_mode =
            if contract.declarer != user_seat && partner_seat(contract.declarer) != user_seat {
                PromptMode::Defender
            } else if contract.declarer == user_seat {
                PromptMode::SouthDeclarer
            } else {
                PromptMode::DeclarerSwap
            };

        // Face-up seats: user + partner preview based on prompt mode
        let face_up_seats = {
            let mut s = HashSet::new();
            s.insert(user_seat);
            match prompt_mode {
                PromptMode::SouthDeclarer => {
                    // User is declarer — show dummy (partner of declarer)
                    s.insert(partner_seat(contract.declarer));
                }
                PromptMode::DeclarerSwap => {
                    // User's partner is declarer — show declarer's hand
                    s.insert(contract.declarer);
                }
                PromptMode::Defender => {}
            }
            s
        };

        let viewport = build_declarer_prompt_viewport(BuildDeclarerPromptViewportInput {
            deal: &session.state.deal,
            user_seat,
            face_up_seats: &face_up_seats,
            auction: &session.state.auction,
            bid_history: &session.state.bid_history,
            contract,
            prompt_mode,
        });

        Ok(Some(viewport))
    }

    fn get_playing_viewport(&self, handle: &str) -> Result<Option<PlayingViewport>, ServiceError> {
        let session = self.manager.get(handle)?;

        if session.state.phase != GamePhase::Playing {
            return Ok(None);
        }

        let face_up_seats = {
            let mut s = HashSet::new();
            s.insert(session.state.user_seat);
            // Dummy is also face-up during play
            if let Some(dummy) = session.state.play.dummy_seat {
                s.insert(dummy);
            }
            s
        };

        // Build user-controlled seats list
        let user_controlled = {
            let mut seats = vec![session.state.user_seat];
            if let Some(ref contract) = session.state.contract {
                if let Some(effective) = session.state.effective_user_seat {
                    if contract.declarer == effective {
                        seats.push(partner_seat(contract.declarer));
                    }
                }
            }
            seats
        };

        // Build remaining cards map
        let mut remaining_cards = HashMap::new();
        for &seat in &SEATS {
            remaining_cards.insert(seat, session.state.get_remaining_cards(seat));
        }

        // Build legal plays for current player
        let legal_plays = if let Some(current) = session.state.play.current_player {
            let remaining = session.state.get_remaining_cards(current);
            let lead_suit = session.state.get_lead_suit();
            bridge_engine::play::get_legal_plays(
                &bridge_engine::types::Hand { cards: remaining },
                lead_suit,
            )
        } else {
            Vec::new()
        };

        let viewport = build_playing_viewport(BuildPlayingViewportInput {
            deal: &session.state.deal,
            user_seat: session.state.user_seat,
            face_up_seats: &face_up_seats,
            auction: Some(&session.state.auction),
            bid_history: Some(&session.state.bid_history),
            rotated: session.state.effective_user_seat == Some(Seat::North),
            contract: session.state.contract.clone(),
            current_player: session.state.play.current_player,
            current_trick: session.state.play.current_trick.clone(),
            trump_suit: session.state.play.trump_suit,
            legal_plays,
            user_controlled_seats: user_controlled,
            remaining_cards,
            tricks: session.state.play.tricks.clone(),
            declarer_tricks_won: session.state.play.declarer_tricks_won,
            defender_tricks_won: session.state.play.defender_tricks_won,
        });

        Ok(Some(viewport))
    }

    fn get_explanation_viewport(
        &self,
        handle: &str,
    ) -> Result<Option<ExplanationViewport>, ServiceError> {
        let session = self.manager.get(handle)?;

        if session.state.phase != GamePhase::Explanation {
            return Ok(None);
        }

        let viewport = build_explanation_viewport(BuildExplanationViewportInput {
            deal: &session.state.deal,
            user_seat: session.state.user_seat,
            auction: &session.state.auction,
            bid_history: session.state.bid_history.clone(),
            contract: session.state.contract.clone(),
            score: session.state.play.play_score,
            declarer_tricks_won: session.state.play.declarer_tricks_won,
            defender_tricks_won: session.state.play.defender_tricks_won,
            tricks: session.state.play.tricks.clone(),
            play_recommendations: Vec::new(),
        });

        Ok(Some(viewport))
    }

    // ── Inference ──────────────────────────────────────────────────

    fn get_public_belief_state(
        &self,
        handle: &str,
    ) -> Result<ServicePublicBeliefState, ServiceError> {
        let session = self.manager.get(handle)?;
        Ok(ServicePublicBeliefState::from(
            &session.state.public_belief_state,
        ))
    }

    // ── DDS ────────────────────────────────────────────────────────

    fn get_dds_solution(&self, _handle: &str) -> Result<DDSolutionResult, ServiceError> {
        Err(ServiceError::DdsNotAvailable)
    }

    // ── Catalog ────────────────────────────────────────────────────

    fn list_conventions(&self) -> Vec<ConventionInfo> {
        bundle_resolver::list_conventions()
    }

    fn list_modules(&self) -> Vec<ModuleCatalogEntry> {
        build_module_catalog(BaseSystemId::Sayc)
    }

    // ── Learning ───────────────────────────────────────────────────

    fn get_module_learning_viewport(&self, module_id: &str) -> Option<ModuleLearningViewport> {
        build_module_learning_viewport(module_id, BaseSystemId::Sayc)
    }

    fn get_bundle_flow_tree(&self, bundle_id: &str) -> Option<BundleFlowTreeViewport> {
        build_bundle_flow_tree(bundle_id, BaseSystemId::Sayc)
    }

    fn get_module_flow_tree(&self, module_id: &str) -> Option<ModuleFlowTreeViewport> {
        build_module_flow_tree(module_id, BaseSystemId::Sayc)
    }

    // ── Workshop ──────────────────────────────────────────────────

    fn fork_module(&self, source_module_id: &str) -> Result<String, ServiceError> {
        use bridge_conventions::registry::module_registry::get_module;

        let source = get_module(source_module_id, BaseSystemId::Sayc).ok_or_else(|| {
            ServiceError::ModuleNotFound(format!("Module '{}' not found", source_module_id))
        })?;

        let mut forked = source.clone();
        // Generate a random hex ID (16 bytes = 32 hex chars) using the existing rand crate
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let id_bytes: [u8; 16] = rng.gen();
        let hex_id: String = id_bytes.iter().map(|b| format!("{:02x}", b)).collect();
        forked.module_id = format!("user:{}", hex_id);
        forked.display_name = format!("My {}", source.display_name);
        forked.variant_of = Some(source_module_id.to_string());

        serde_json::to_string(&forked).map_err(|e| ServiceError::Internal(e.to_string()))
    }

    fn get_module_config_schema(
        &self,
        module_id: &str,
        user_modules_json: Option<&str>,
    ) -> Result<crate::config_schema_types::ModuleConfigSchemaView, ServiceError> {
        let (module, ownership) = resolve_module_for_schema(module_id, user_modules_json)?;
        let forked_from = module.variant_of.clone();

        let surfaces = build_configurable_surfaces(&module);

        Ok(crate::config_schema_types::ModuleConfigSchemaView {
            module_id: module.module_id.clone(),
            display_name: module.display_name.clone(),
            category: module.category,
            ownership,
            forked_from,
            surfaces,
        })
    }

    fn validate_module(
        &self,
        module_json: &str,
    ) -> Result<crate::config_schema_types::ValidationResult, ServiceError> {
        let module: ConventionModule = serde_json::from_str(module_json)
            .map_err(|e| ServiceError::Internal(format!("Failed to parse module JSON: {}", e)))?;

        let errors = validate_module_content(&module);
        Ok(crate::config_schema_types::ValidationResult {
            valid: errors.is_empty(),
            errors,
        })
    }
}

// ── DevServicePort implementation ─────────────────────────────────

impl ServicePortImpl {
    /// Extract the ConventionStrategyAdapter from the user seat's strategy.
    /// Returns None if the seat uses a heuristic strategy (no convention pipeline).
    fn get_convention_adapter(
        session: &crate::session_manager::ActiveSession,
    ) -> Option<&crate::convention_adapter::ConventionStrategyAdapter> {
        let strategy = session.seat_strategies.get(&session.state.user_seat)?;
        match strategy {
            SeatStrategy::Ai(boxed) => boxed
                .as_any()
                .downcast_ref::<crate::convention_adapter::ConventionStrategyAdapter>(
            ),
            _ => None,
        }
    }

    fn build_user_bidding_context(
        session: &crate::session_manager::ActiveSession,
    ) -> Option<bridge_session::heuristics::BiddingContext> {
        let seat = session.state.user_seat;
        let hand = session.state.deal.hands.get(&seat)?.clone();
        let evaluation = bridge_engine::hand_evaluator::evaluate_hand_hcp(&hand);
        Some(bridge_session::heuristics::BiddingContext {
            hand,
            auction: session.state.auction.clone(),
            seat,
            evaluation,
            vulnerability: Some(session.state.deal.vulnerability),
            dealer: Some(session.state.deal.dealer),
        })
    }
}

// ── DDS play helpers (not on ServicePort trait — WASM-only) ─────

/// Context for MC+DDS play decision at the current position.
pub struct DdsPlayContext {
    pub current_player: Seat,
    pub legal_plays: Vec<Card>,
    pub contract: bridge_engine::types::Contract,
    pub current_trick: Vec<bridge_engine::types::PlayedCard>,
    pub remaining_cards: HashMap<Seat, Vec<Card>>,
    pub visible_seats: Vec<Seat>,
    pub beliefs: HashMap<Seat, bridge_session::inference::types::DerivedRanges>,
    pub use_constraints: bool,
}

impl ServicePortImpl {
    /// Check if the current profile requires DDS-based play.
    pub fn needs_dds_play(&self, handle: &str) -> Result<bool, ServiceError> {
        let session = self.manager.get(handle)?;
        let profile =
            bridge_session::heuristics::play_profiles::get_profile(session.state.play_profile_id);
        Ok(profile.use_posterior)
    }

    /// Play a single card without running the AI loop. For WASM DDS orchestration.
    pub fn apply_single_card(
        &mut self,
        handle: &str,
        card: Card,
        seat: Seat,
    ) -> Result<bridge_session::session::SingleCardResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;
        if session.state.phase != GamePhase::Playing {
            return Err(ServiceError::WrongPhase);
        }
        Ok(bridge_session::session::process_single_card(
            &mut session.state,
            card,
            seat,
        ))
    }

    /// Build DDS play context for the current position. Returns None if play is complete
    /// or current player is user-controlled.
    pub fn get_dds_play_context(
        &self,
        handle: &str,
    ) -> Result<Option<DdsPlayContext>, ServiceError> {
        let session = self.manager.get(handle)?;
        let current_player = match session.state.play.current_player {
            Some(p) => p,
            None => return Ok(None),
        };

        // Only return context for AI-controlled seats
        if session.state.is_user_controlled_play(current_player) {
            return Ok(None);
        }

        let contract = match &session.state.contract {
            Some(c) => c.clone(),
            None => return Ok(None),
        };

        // Legal plays for current player
        let remaining_for_player = session.state.get_remaining_cards(current_player);
        let lead_suit = session.state.get_lead_suit();
        let legal_plays = bridge_engine::play::get_legal_plays(
            &bridge_engine::types::Hand {
                cards: remaining_for_player,
            },
            lead_suit,
        );
        if legal_plays.is_empty() {
            return Ok(None);
        }

        // Remaining cards per seat
        let mut remaining_cards = HashMap::new();
        for &seat in &bridge_engine::constants::SEATS {
            remaining_cards.insert(seat, session.state.get_remaining_cards(seat));
        }

        // Visible seats: user-controlled + dummy
        let mut visible_seats = vec![session.state.user_seat];
        if let Some(dummy) = session.state.play.dummy_seat {
            if !visible_seats.contains(&dummy) {
                visible_seats.push(dummy);
            }
        }

        // Beliefs (DerivedRanges) from inference
        let beliefs: HashMap<Seat, bridge_session::inference::types::DerivedRanges> = session
            .state
            .public_belief_state
            .beliefs
            .iter()
            .map(|(s, b)| (*s, b.ranges.clone()))
            .collect();

        let profile =
            bridge_session::heuristics::play_profiles::get_profile(session.state.play_profile_id);

        Ok(Some(DdsPlayContext {
            current_player,
            legal_plays,
            contract,
            current_trick: session.state.play.current_trick.clone(),
            remaining_cards,
            visible_seats,
            beliefs,
            use_constraints: profile.use_posterior,
        }))
    }

    /// Get deal PBN for internal use (WASM DDS table solver).
    /// Not on ServicePort — only used by WASM layer.
    pub fn get_deal_pbn(&self, handle: &str) -> Result<String, ServiceError> {
        let session = self.manager.get(handle)?;
        Ok(session.state.deal.to_pbn())
    }
}

impl DevServicePort for ServicePortImpl {
    fn get_expected_bid(&self, handle: &str) -> Result<Option<Call>, ServiceError> {
        let session = self.manager.get(handle)?;
        let adapter = match Self::get_convention_adapter(session) {
            Some(a) => a,
            None => return Ok(None),
        };
        let ctx = match Self::build_user_bidding_context(session) {
            Some(c) => c,
            None => return Ok(None),
        };
        // Use suggest_bid() (not suggest_with_evaluation with all_hands) to match
        // the same pipeline path the bidding controller uses for grading.
        // Default to Pass when no convention matches — same as bidding_controller::get_expected_bid.
        let call = adapter
            .suggest_bid(&ctx)
            .map(|b| b.call)
            .unwrap_or(Call::Pass);
        Ok(Some(call))
    }

    fn get_debug_log(&self, handle: &str) -> Result<Vec<ServiceDebugLogEntryDTO>, ServiceError> {
        let session = self.manager.get(handle)?;
        Ok(session
            .state
            .debug_log
            .iter()
            .map(ServiceDebugLogEntryDTO::from)
            .collect())
    }

    fn get_inference_timeline(
        &self,
        handle: &str,
    ) -> Result<Vec<InferenceTimelineEntryDTO>, ServiceError> {
        let session = self.manager.get(handle)?;

        // Combine NS and EW timelines into a single ordered list
        let ns_timeline = session.state.get_ns_timeline();
        let ew_timeline = session.state.get_ew_timeline();

        let mut entries: Vec<InferenceTimelineEntryDTO> = Vec::new();
        let mut turn_index = 0;

        // Interleave based on turn order (NS and EW snapshots correspond to
        // alternating bids in the auction)
        let ns_iter = ns_timeline.iter();
        let ew_iter = ew_timeline.iter();

        for snapshot in ns_iter.chain(ew_iter) {
            entries.push(InferenceTimelineEntryDTO {
                turn_index,
                seat: snapshot.entry.seat,
                call: snapshot.entry.call.clone(),
                new_constraints: snapshot
                    .new_constraints
                    .iter()
                    .map(ServiceFactConstraintDTO::from)
                    .collect(),
                cumulative_beliefs: snapshot
                    .cumulative_beliefs
                    .iter()
                    .map(|(seat, beliefs)| (*seat, ServicePublicBeliefsDTO::from(beliefs)))
                    .collect(),
            });
            turn_index += 1;
        }

        // Sort by actual auction order using turn_index from entry positions
        // The NS/EW timelines are already in order within their pair, so we
        // re-sort based on seat ordering from the actual auction entries
        entries.sort_by_key(|e| {
            session
                .state
                .auction
                .entries
                .iter()
                .position(|ae| ae.seat == e.seat && ae.call == e.call)
                .unwrap_or(e.turn_index)
        });

        // Fix turn indices after sort
        for (i, entry) in entries.iter_mut().enumerate() {
            entry.turn_index = i;
        }

        Ok(entries)
    }

    fn get_convention_name(&self, handle: &str) -> Result<String, ServiceError> {
        let session = self.manager.get(handle)?;
        Ok(session.state.convention_name.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_conventions_returns_bundles() {
        let service = ServicePortImpl::new();
        let conventions = service.list_conventions();
        // Should have at least 1 convention
        assert!(!conventions.is_empty());
        // Check that a known bundle exists
        let nt = conventions.iter().find(|c| c.id == "nt-bundle");
        assert!(nt.is_some(), "Expected nt-bundle in convention list");
    }

    #[test]
    fn list_modules_returns_modules() {
        let service = ServicePortImpl::new();
        let modules = service.list_modules();
        // Should have at least 4 base modules + convention modules
        assert!(
            modules.len() >= 4,
            "Expected at least 4 modules, got {}",
            modules.len()
        );
        // Check that stayman module exists
        let stayman = modules.iter().find(|m| m.module_id == "stayman");
        assert!(stayman.is_some(), "Expected stayman module in list");
    }

    #[test]
    fn get_module_learning_viewport_known() {
        let service = ServicePortImpl::new();
        let vp = service.get_module_learning_viewport("stayman");
        assert!(vp.is_some(), "Expected stayman learning viewport");
    }

    #[test]
    fn get_module_learning_viewport_unknown() {
        let service = ServicePortImpl::new();
        let vp = service.get_module_learning_viewport("nonexistent-module");
        assert!(vp.is_none());
    }

    #[test]
    fn get_bundle_flow_tree_known() {
        let service = ServicePortImpl::new();
        let tree = service.get_bundle_flow_tree("nt-bundle");
        assert!(tree.is_some(), "Expected nt-bundle flow tree");
    }

    #[test]
    fn get_module_flow_tree_known() {
        let service = ServicePortImpl::new();
        let tree = service.get_module_flow_tree("stayman");
        assert!(tree.is_some(), "Expected stayman flow tree");
    }

    #[test]
    fn dds_solution_returns_unavailable() {
        let service = ServicePortImpl::new();
        let result = service.get_dds_solution("session-1");
        assert!(matches!(result, Err(ServiceError::DdsNotAvailable)));
    }

    // ── Initial auction integration tests ────────────────────────

    use bridge_engine::types::{BidSuit, Call};

    fn create_session_for_bundle(
        service: &mut ServicePortImpl,
        convention_id: &str,
        seed: u64,
    ) -> (DrillHandle, crate::response_types::DrillStartResult) {
        let config = SessionConfig {
            convention_id: convention_id.to_string(),
            seed: Some(seed),
            user_seat: None,
            system_config: bridge_conventions::registry::system_configs::get_system_config(
                bridge_conventions::types::system_config::BaseSystemId::Sayc,
            ),
            base_module_ids: bridge_conventions::registry::module_registry::BASE_MODULE_IDS
                .iter()
                .map(|s| s.to_string())
                .collect(),
            practice_mode: None,
            target_module_id: None,
            practice_role: None,
            play_preference: None,
            opponent_mode: None,
            vulnerability: None,
        };
        let handle = service
            .create_drill_session(config)
            .expect("create_drill_session should succeed");
        let result = service
            .start_drill(&handle)
            .expect("start_drill should succeed");
        (handle, result)
    }

    #[test]
    fn bergen_session_has_major_opening_in_viewport() {
        let mut service = ServicePortImpl::new();
        // Try several seeds to verify consistent behavior
        for seed in 42..52 {
            let (_handle, result) = create_session_for_bundle(&mut service, "bergen-bundle", seed);

            // The viewport's auction entries should contain at least one entry
            // with a 1H or 1S opening from the dealer (North)
            let has_major_opening = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    Call::Bid {
                        level: 1,
                        strain: BidSuit::Hearts
                    } | Call::Bid {
                        level: 1,
                        strain: BidSuit::Spades
                    }
                )
            });
            assert!(
                has_major_opening,
                "seed={seed}: Bergen session should have 1H or 1S in auction, got: {:?}",
                result
                    .viewport
                    .auction_entries
                    .iter()
                    .map(|e| &e.call)
                    .collect::<Vec<_>>()
            );

            // Should NOT have a 1NT opening (the bug we're fixing)
            let has_1nt = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump
                    }
                )
            });
            assert!(
                !has_1nt,
                "seed={seed}: Bergen session should not have 1NT opening"
            );
        }
    }

    // Phase 3: rejection sampling in start_drill re-establishes the 1NT
    // guarantee by rejecting candidate deals whose user-turn suggestion isn't
    // produced by a target-bundle module.
    #[test]
    fn nt_session_has_1nt_opening_in_viewport() {
        let mut service = ServicePortImpl::new();
        for seed in 42..47 {
            let (_handle, result) = create_session_for_bundle(&mut service, "nt-bundle", seed);

            let has_1nt = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump
                    }
                )
            });
            assert!(
                has_1nt,
                "seed={seed}: NT session should have 1NT in auction, got: {:?}",
                result
                    .viewport
                    .auction_entries
                    .iter()
                    .map(|e| &e.call)
                    .collect::<Vec<_>>()
            );
        }
    }

    #[test]
    fn bergen_opening_matches_deal_major() {
        let mut service = ServicePortImpl::new();
        for seed in 42..52 {
            let (handle, result) = create_session_for_bundle(&mut service, "bergen-bundle", seed);

            // Get the deal PBN to verify the opening matches the hand
            let _pbn = service.get_deal_pbn(&handle).expect("get_deal_pbn");

            // The first auction entry should be the pre-filled opening
            let first_entry = &result.viewport.auction_entries[0];
            assert_eq!(
                first_entry.seat, result.viewport.dealer,
                "First bid should be from dealer"
            );
            match &first_entry.call {
                Call::Bid {
                    level: 1,
                    strain: BidSuit::Hearts,
                }
                | Call::Bid {
                    level: 1,
                    strain: BidSuit::Spades,
                } => {}
                other => panic!(
                    "seed={seed}: Expected 1H or 1S as first bid, got {:?}",
                    other
                ),
            }
        }
    }
}
