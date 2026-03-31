//! ServicePortImpl — main implementation of ServicePort and DevServicePort.
//!
//! Wraps a SessionManager and delegates to bridge-session controllers.
//! All methods are synchronous.

use std::collections::{HashMap, HashSet};

use bridge_conventions::registry::bundle_registry::{list_bundle_inputs, resolve_bundle};
use bridge_conventions::BaseSystemId;
use bridge_engine::types::{Call, Card, Seat, Vulnerability};
use bridge_engine::constants::{partner_seat, SEATS};
use bridge_session::session::{
    build_bidding_viewport, build_declarer_prompt_viewport, build_explanation_viewport,
    build_playing_viewport, build_module_catalog, build_module_learning_viewport,
    build_bundle_flow_tree, build_module_flow_tree, process_bid, run_initial_ai_bids,
    process_play_card, run_initial_ai_plays, start_drill, BiddingViewport,
    BuildBiddingViewportInput, BuildDeclarerPromptViewportInput,
    BuildExplanationViewportInput, BuildPlayingViewportInput, DeclarerPromptViewport,
    DrillConfig, ExplanationViewport, ModuleCatalogEntry, ModuleLearningViewport,
    PlayCardResult, PlayingViewport, SeatStrategy, SessionState,
    BundleFlowTreeViewport, ModuleFlowTreeViewport,
};
use bridge_session::session::start_drill::{ConventionConfig, StartDrillOptions};
use bridge_session::inference::InferenceCoordinator;
use bridge_session::types::{
    GamePhase, OpponentMode, PracticeMode, PracticeRole, PromptMode,
};

use crate::error::ServiceError;
use crate::evaluation::types::{AtomGradeResult, PlaythroughGradeResult, PlaythroughStartResult};
use crate::port::{DevServicePort, ServicePort};
use crate::request_types::{SessionConfig, SessionHandle};
use crate::response_types::{
    AiBidEntryDTO, AiPlayEntryDTO, BidSubmitResult, ConventionInfo, DDSolutionResult,
    DrillStartResult, PhaseTransition, PromptAcceptResult, ServicePublicBeliefState,
};
use crate::session_manager::SessionManager;

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

    /// Parse a base system ID string, defaulting to SAYC.
    fn resolve_system(base_system: Option<&str>) -> BaseSystemId {
        match base_system {
            Some("two-over-one") => BaseSystemId::TwoOverOne,
            Some("acol") => BaseSystemId::Acol,
            _ => BaseSystemId::Sayc,
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

    fn create_session(&mut self, config: SessionConfig) -> Result<SessionHandle, ServiceError> {
        let system = Self::resolve_system(config.base_system_id.as_deref());
        let user_seat = config.user_seat.unwrap_or(Seat::South);
        let practice_mode = config.practice_mode.unwrap_or(PracticeMode::DecisionDrill);
        let practice_role = config.practice_role.unwrap_or(PracticeRole::Responder);
        let play_preference_override = config.play_preference;
        let opponent_mode = config.opponent_mode.unwrap_or(OpponentMode::Natural);

        // Look up the bundle from the registry
        let bundle_input = bridge_conventions::registry::get_bundle_input(&config.convention_id)
            .ok_or_else(|| ServiceError::BundleNotFound(config.convention_id.clone()))?;

        // Build convention spec and surface groups for strategy wiring
        let spec = bridge_conventions::registry::spec_builder::spec_from_bundle(
            &config.convention_id,
            system,
        );

        // Resolve the full bundle for deal constraints + surface groups
        let resolved = resolve_bundle(&config.convention_id, system);

        // Convert bundle SurfaceGroups (types::teaching) to teaching::teaching_types SurfaceGroups
        let surface_groups: Vec<bridge_conventions::teaching::teaching_types::SurfaceGroup> =
            resolved
                .map(|b| {
                    b.derived_teaching
                        .surface_groups
                        .iter()
                        .map(|sg| bridge_conventions::teaching::teaching_types::SurfaceGroup {
                            id: sg.id.clone(),
                            label: sg.label.clone(),
                            members: sg.members.clone(),
                            relationship: match sg.relationship {
                                bridge_conventions::types::teaching::SurfaceGroupRelationship::MutuallyExclusive => {
                                    bridge_conventions::teaching::teaching_types::SurfaceGroupRelationship::MutuallyExclusive
                                }
                                bridge_conventions::types::teaching::SurfaceGroupRelationship::EquivalentEncoding => {
                                    bridge_conventions::teaching::teaching_types::SurfaceGroupRelationship::EquivalentEncoding
                                }
                                bridge_conventions::types::teaching::SurfaceGroupRelationship::PolicyAlternative => {
                                    bridge_conventions::teaching::teaching_types::SurfaceGroupRelationship::PolicyAlternative
                                }
                            },
                            description: sg.description.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default();

        // Build deal constraints from the resolved bundle
        let bundle_constraints = resolved
            .map(|b| b.deal_constraints.clone())
            .unwrap_or_else(|| bridge_engine::types::DealConstraints {
                seats: vec![],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: None,
                seed: None,
            });

        let convention_config = ConventionConfig {
            id: config.convention_id.clone(),
            deal_constraints: bridge_engine::types::DealConstraints {
                vulnerability: config.vulnerability,
                max_attempts: Some(50_000),
                seed: config.seed,
                ..bundle_constraints
            },
            allowed_dealers: resolved.and_then(|b| b.allowed_dealers.clone()),
            off_convention_constraints: resolved.and_then(|b| b.off_convention_constraints.clone()),
        };

        let drill_config = DrillConfig {
            convention_id: config.convention_id.clone(),
            user_seat,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            practice_mode,
            practice_role,
            play_preference: play_preference_override,
            opponent_mode,
            seed: config.seed,
            ..Default::default()
        };

        // RNG closure from seed
        let seed = config.seed.unwrap_or(0);
        use rand::SeedableRng;
        use rand::Rng;
        let mut rng = rand_chacha::ChaCha8Rng::seed_from_u64(seed);
        let mut rng_fn = move || -> f64 { rng.gen() };

        let drill_bundle = start_drill(
            &convention_config,
            user_seat,
            drill_config,
            &options,
            &mut rng_fn,
        )
        .map_err(|e| ServiceError::Internal(e))?;

        // Build inference coordinator
        let coordinator = InferenceCoordinator::new(None);

        // Create SessionState
        let state = SessionState::new(
            drill_bundle.deal,
            user_seat,
            config.convention_id.clone(),
            Some(bundle_input.name.clone()),
            coordinator,
            drill_bundle.is_off_convention,
            drill_bundle.practice_mode,
            drill_bundle.practice_focus,
            drill_bundle.play_preference,
        );

        // Build seat strategies for the session manager
        let seat_strategies: HashMap<Seat, SeatStrategy> = {
            let mut m = HashMap::new();
            if let Some(ref spec) = spec {
                // User seat + partner get convention strategy for grading/bidding
                m.insert(
                    user_seat,
                    SeatStrategy::Ai(Box::new(
                        crate::convention_adapter::ConventionStrategyAdapter::new(
                            spec.clone(),
                            surface_groups.clone(),
                        ),
                    )),
                );
                m.insert(
                    partner_seat(user_seat),
                    SeatStrategy::Ai(Box::new(
                        crate::convention_adapter::ConventionStrategyAdapter::new(
                            spec.clone(),
                            surface_groups.clone(),
                        ),
                    )),
                );
            }
            // Opponents get strategy based on opponent_mode
            let opp_seats = [
                bridge_engine::constants::next_seat(user_seat),
                bridge_engine::constants::next_seat(partner_seat(user_seat)),
            ];
            for &opp in &opp_seats {
                match opponent_mode {
                    OpponentMode::Natural => {
                        m.insert(
                            opp,
                            SeatStrategy::Ai(Box::new(
                                bridge_session::heuristics::NaturalFallbackStrategy,
                            )),
                        );
                    }
                    OpponentMode::None => {
                        m.insert(
                            opp,
                            SeatStrategy::Ai(Box::new(bridge_session::heuristics::PassStrategy)),
                        );
                    }
                };
            }
            m
        };

        // Build debug adapter for pipeline introspection
        let debug_adapter = spec.map(|s| {
            crate::convention_adapter::ConventionStrategyAdapter::new(s, surface_groups)
        });

        let handle = self.manager.create(
            state,
            DrillConfig {
                convention_id: config.convention_id,
                user_seat,
                seat_strategies: HashMap::new(),
            },
            seat_strategies,
            debug_adapter,
        );

        Ok(handle)
    }

    fn start_drill(&mut self, handle: &str) -> Result<DrillStartResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;

        // Run initial AI bids
        let ai_bids = run_initial_ai_bids(&mut session.state, &session.seat_strategies);

        // Build bidding viewport
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
            bid_history: &[],
            legal_calls: &session.state.legal_calls,
            face_up_seats: &face_up_seats,
            convention_name: session.state.convention_name.clone(),
            is_user_turn,
            current_bidder,
            practice_mode: Some(session.state.practice_mode),
        });

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

            Some(build_bidding_viewport(BuildBiddingViewportInput {
                deal: &session.state.deal,
                user_seat: session.state.user_seat,
                auction: &session.state.auction,
                bid_history: &[],
                legal_calls: &session.state.legal_calls,
                face_up_seats: &face_up_seats,
                convention_name: session.state.convention_name.clone(),
                is_user_turn,
                current_bidder,
                practice_mode: Some(session.state.practice_mode),
            }))
        } else {
            None
        };

        let phase_transition = result.phase_transition.map(|(from, to)| PhaseTransition {
            from,
            to,
        });

        let grade = result.feedback.as_ref().map(|f| f.grade);

        Ok(BidSubmitResult {
            accepted: result.accepted,
            grade,
            feedback: result.feedback,
            ai_bids: result.ai_bids.into_iter().map(AiBidEntryDTO::from).collect(),
            next_viewport,
            phase_transition,
        })
    }

    // ── Phase transitions ──────────────────────────────────────────

    fn accept_prompt(
        &mut self,
        handle: &str,
        mode: Option<&str>,
        seat_override: Option<Seat>,
    ) -> Result<PromptAcceptResult, ServiceError> {
        let session = self.manager.get_mut(handle)?;

        match mode {
            Some("skip") | None => {
                session.state.phase = GamePhase::Explanation;
                Ok(PromptAcceptResult {
                    phase: session.state.phase,
                    ai_plays: None,
                })
            }
            Some("play") => {
                // Transition to playing
                if let Some(ref contract) = session.state.contract {
                    let contract = contract.clone();
                    if let Some(seat) = seat_override {
                        session.state.effective_user_seat = Some(seat);
                    }
                    session.state.initialize_play(&contract);
                    session.state.phase = GamePhase::Playing;

                    let ai_plays = run_initial_ai_plays(&mut session.state);
                    let ai_play_dtos: Vec<AiPlayEntryDTO> =
                        ai_plays.into_iter().map(AiPlayEntryDTO::from).collect();

                    Ok(PromptAcceptResult {
                        phase: session.state.phase,
                        ai_plays: if ai_play_dtos.is_empty() {
                            None
                        } else {
                            Some(ai_play_dtos)
                        },
                    })
                } else {
                    // Passout — skip to explanation
                    session.state.phase = GamePhase::Explanation;
                    Ok(PromptAcceptResult {
                        phase: session.state.phase,
                        ai_plays: None,
                    })
                }
            }
            Some("replay") => {
                // Transition back to DECLARER_PROMPT from EXPLANATION
                session.state.phase = GamePhase::DeclarerPrompt;
                Ok(PromptAcceptResult {
                    phase: session.state.phase,
                    ai_plays: None,
                })
            }
            Some("restart") => {
                // Reset play state and restart from current position
                session.state.play = bridge_session::session::PlayState::default();
                if let Some(ref contract) = session.state.contract {
                    let contract = contract.clone();
                    session.state.initialize_play(&contract);
                }

                let ai_plays = run_initial_ai_plays(&mut session.state);
                let ai_play_dtos: Vec<AiPlayEntryDTO> =
                    ai_plays.into_iter().map(AiPlayEntryDTO::from).collect();

                Ok(PromptAcceptResult {
                    phase: session.state.phase,
                    ai_plays: if ai_play_dtos.is_empty() {
                        None
                    } else {
                        Some(ai_play_dtos)
                    },
                })
            }
            Some(other) => Err(ServiceError::Internal(format!(
                "Unknown prompt mode: {}",
                other
            ))),
        }
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

    fn update_play_profile(&mut self, handle: &str, _profile_id: &str) -> Result<(), ServiceError> {
        // Validate session exists
        let _session = self.manager.get_mut(handle)?;
        // Play profile updates deferred — play strategy is heuristic-only in Phase 4
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
            bid_history: &[],
            legal_calls: &session.state.legal_calls,
            face_up_seats: &face_up_seats,
            convention_name: session.state.convention_name.clone(),
            is_user_turn,
            current_bidder,
            practice_mode: Some(session.state.practice_mode),
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
        let prompt_mode = if contract.declarer != user_seat
            && partner_seat(contract.declarer) != user_seat
        {
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
            bid_history: &[],
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
            bid_history: None,
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
            bid_history: Vec::new(),
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
        let _session = self.manager.get(handle)?;
        // Posterior engine is stub in Phase 4
        Ok(ServicePublicBeliefState {
            beliefs: serde_json::Value::Null,
            annotations: Vec::new(),
        })
    }

    // ── DDS ────────────────────────────────────────────────────────

    fn get_dds_solution(&self, _handle: &str) -> Result<DDSolutionResult, ServiceError> {
        Err(ServiceError::DdsNotAvailable)
    }

    // ── Catalog ────────────────────────────────────────────────────

    fn list_conventions(&self) -> Vec<ConventionInfo> {
        let bundles = list_bundle_inputs();
        bundles
            .iter()
            .filter(|b| b.internal != Some(true))
            .map(|b| {
                let module_descriptions = resolve_bundle(&b.id, BaseSystemId::Sayc)
                    .map(|bundle| {
                        bundle.modules.iter()
                            .map(|m| (m.module_id.clone(), m.description.to_string()))
                            .collect::<HashMap<String, String>>()
                    });
                ConventionInfo {
                    id: b.id.clone(),
                    name: b.name.clone(),
                    description: b.description.clone(),
                    category: format!("{:?}", b.category).to_lowercase(),
                    module_ids: b.member_ids.clone(),
                    module_descriptions,
                    teaching: b.teaching.clone(),
                }
            })
            .collect()
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

    // ── Evaluation (stubs) ─────────────────────────────────────────

    fn evaluate_atom(
        &mut self,
        _bundle_id: &str,
        _atom_id: &str,
        _seed: u64,
        _vuln: Option<Vulnerability>,
        _base_system: Option<&str>,
    ) -> Result<BiddingViewport, ServiceError> {
        Err(ServiceError::Internal("not yet implemented".to_string()))
    }

    fn grade_atom(
        &mut self,
        _bundle_id: &str,
        _atom_id: &str,
        _seed: u64,
        _bid: &str,
        _vuln: Option<Vulnerability>,
        _base_system: Option<&str>,
    ) -> Result<AtomGradeResult, ServiceError> {
        Err(ServiceError::Internal("not yet implemented".to_string()))
    }

    fn start_playthrough(
        &mut self,
        _bundle_id: &str,
        _seed: u64,
        _vuln: Option<Vulnerability>,
        _opponents: Option<OpponentMode>,
        _base_system: Option<&str>,
    ) -> Result<PlaythroughStartResult, ServiceError> {
        Err(ServiceError::Internal("not yet implemented".to_string()))
    }

    fn get_playthrough_step(
        &self,
        _bundle_id: &str,
        _seed: u64,
        _step_idx: usize,
        _vuln: Option<Vulnerability>,
        _opponents: Option<OpponentMode>,
        _base_system: Option<&str>,
    ) -> Result<BiddingViewport, ServiceError> {
        Err(ServiceError::Internal("not yet implemented".to_string()))
    }

    fn grade_playthrough_bid(
        &mut self,
        _bundle_id: &str,
        _seed: u64,
        _step_idx: usize,
        _bid: &str,
        _vuln: Option<Vulnerability>,
        _opponents: Option<OpponentMode>,
        _base_system: Option<&str>,
    ) -> Result<PlaythroughGradeResult, ServiceError> {
        Err(ServiceError::Internal("not yet implemented".to_string()))
    }
}

// ── DevServicePort implementation ─────────────────────────────────

impl ServicePortImpl {
    /// Build a BiddingContext for the user seat from current session state.
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

impl DevServicePort for ServicePortImpl {
    fn get_expected_bid(&self, handle: &str) -> Result<Option<Call>, ServiceError> {
        let session = self.manager.get(handle)?;
        let adapter = match &session.debug_adapter {
            Some(a) => a,
            None => return Ok(None),
        };
        let ctx = match Self::build_user_bidding_context(session) {
            Some(c) => c,
            None => return Ok(None),
        };
        let (bid, _eval) = adapter.suggest_with_evaluation(&ctx, Some(&session.state.deal.hands));
        Ok(bid.map(|b| b.call))
    }

    fn get_debug_snapshot(&self, handle: &str) -> Result<serde_json::Value, ServiceError> {
        let session = self.manager.get(handle)?;
        let adapter = match &session.debug_adapter {
            Some(a) => a,
            None => return Ok(serde_json::Value::Null),
        };
        let ctx = match Self::build_user_bidding_context(session) {
            Some(c) => c,
            None => return Ok(serde_json::Value::Null),
        };
        let (bid, evaluation) = adapter.suggest_with_evaluation(&ctx, Some(&session.state.deal.hands));

        // Build ServiceDebugSnapshot shape: { sessionPhase, expectedBid, ...evaluation }
        let mut snapshot = serde_json::to_value(&evaluation)
            .unwrap_or(serde_json::Value::Null);
        if let serde_json::Value::Object(ref mut map) = snapshot {
            map.insert(
                "sessionPhase".to_string(),
                serde_json::to_value(&session.state.phase).unwrap_or(serde_json::Value::Null),
            );
            map.insert(
                "expectedBid".to_string(),
                bid.map(|b| serde_json::json!({
                    "call": serde_json::to_value(&b.call).unwrap_or(serde_json::Value::Null),
                    "explanation": b.explanation,
                }))
                    .unwrap_or(serde_json::Value::Null),
            );
        }
        Ok(snapshot)
    }

    fn get_debug_log(&self, handle: &str) -> Result<Vec<serde_json::Value>, ServiceError> {
        let session = self.manager.get(handle)?;

        // Build a single "pre-bid" entry with the current pipeline snapshot
        let adapter = match &session.debug_adapter {
            Some(a) => a,
            None => return Ok(Vec::new()),
        };
        let ctx = match Self::build_user_bidding_context(session) {
            Some(c) => c,
            None => return Ok(Vec::new()),
        };
        let (bid, evaluation) = adapter.suggest_with_evaluation(&ctx, Some(&session.state.deal.hands));

        // Build snapshot shape
        let mut snapshot = serde_json::to_value(&evaluation)
            .unwrap_or(serde_json::Value::Null);
        if let serde_json::Value::Object(ref mut map) = snapshot {
            map.insert(
                "expectedBid".to_string(),
                bid.as_ref()
                    .map(|b| serde_json::json!({
                        "call": serde_json::to_value(&b.call).unwrap_or(serde_json::Value::Null),
                        "explanation": b.explanation,
                    }))
                    .unwrap_or(serde_json::Value::Null),
            );
        }

        let entry = serde_json::json!({
            "kind": "pre-bid",
            "turnIndex": session.state.auction.entries.len(),
            "seat": session.state.user_seat,
            "snapshot": snapshot,
            "feedback": null
        });

        Ok(vec![entry])
    }

    fn get_inference_timeline(&self, handle: &str) -> Result<Vec<serde_json::Value>, ServiceError> {
        let _session = self.manager.get(handle)?;
        Ok(Vec::new())
    }

    fn get_play_suggestions(&self, handle: &str) -> Result<serde_json::Value, ServiceError> {
        let _session = self.manager.get(handle)?;
        Ok(serde_json::Value::Null)
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

    #[test]
    fn evaluate_atom_returns_not_implemented() {
        let mut service = ServicePortImpl::new();
        let result = service.evaluate_atom("nt-bundle", "atom-1", 42, None, None);
        assert!(result.is_err());
    }
}
