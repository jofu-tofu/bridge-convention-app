//! ServicePort and DevServicePort traits — the hexagonal boundary.
//!
//! All methods are synchronous. The UI/WASM layer calls these traits;
//! implementations delegate to bridge-session controllers.

use bridge_engine::types::{Call, Card, Seat, Vulnerability};
use bridge_session::session::{
    BiddingViewport, DeclarerPromptViewport, ExplanationViewport, ModuleCatalogEntry,
    ModuleLearningViewport, PlayCardResult, PlayingViewport,
    BundleFlowTreeViewport, ModuleFlowTreeViewport,
};
use bridge_session::types::OpponentMode;

use crate::error::ServiceError;
use crate::evaluation::types::{AtomGradeResult, PlaythroughGradeResult, PlaythroughStartResult};
use crate::request_types::{SessionConfig, SessionHandle};
use crate::response_types::{
    BidSubmitResult, ConventionInfo, DDSolutionResult, DrillStartResult,
    PromptAcceptResult, ServicePublicBeliefState,
};

/// Production service interface — all methods synchronous.
pub trait ServicePort {
    // ── Session lifecycle ──────────────────────────────────────────

    /// Create a new drill session from configuration.
    fn create_session(&mut self, config: SessionConfig) -> Result<SessionHandle, ServiceError>;

    /// Start the drill: generate deal, run initial AI bids, return viewport.
    fn start_drill(&mut self, handle: &str) -> Result<DrillStartResult, ServiceError>;

    // ── Bidding ────────────────────────────────────────────────────

    /// Submit a user bid, get grading + AI continuation.
    fn submit_bid(&mut self, handle: &str, call: Call) -> Result<BidSubmitResult, ServiceError>;

    // ── Phase transitions ──────────────────────────────────────────

    /// Accept a prompt (play/skip/replay/restart).
    fn accept_prompt(
        &mut self,
        handle: &str,
        mode: Option<&str>,
        seat_override: Option<Seat>,
    ) -> Result<PromptAcceptResult, ServiceError>;

    // ── Play ───────────────────────────────────────────────────────

    /// Play a card during the play phase.
    fn play_card(
        &mut self,
        handle: &str,
        card: Card,
        seat: Seat,
    ) -> Result<PlayCardResult, ServiceError>;

    /// Skip play phase, go directly to review.
    fn skip_to_review(&mut self, handle: &str) -> Result<(), ServiceError>;

    /// Update the play profile for AI play style.
    fn update_play_profile(&mut self, handle: &str, profile_id: &str) -> Result<(), ServiceError>;

    // ── Query (viewport getters) ───────────────────────────────────

    fn get_bidding_viewport(&self, handle: &str) -> Result<Option<BiddingViewport>, ServiceError>;
    fn get_declarer_prompt_viewport(
        &self,
        handle: &str,
    ) -> Result<Option<DeclarerPromptViewport>, ServiceError>;
    fn get_playing_viewport(&self, handle: &str) -> Result<Option<PlayingViewport>, ServiceError>;
    fn get_explanation_viewport(
        &self,
        handle: &str,
    ) -> Result<Option<ExplanationViewport>, ServiceError>;

    // ── Inference ──────────────────────────────────────────────────

    fn get_public_belief_state(
        &self,
        handle: &str,
    ) -> Result<ServicePublicBeliefState, ServiceError>;

    // ── DDS ────────────────────────────────────────────────────────

    fn get_dds_solution(&self, handle: &str) -> Result<DDSolutionResult, ServiceError>;

    // ── Catalog ────────────────────────────────────────────────────

    fn list_conventions(&self) -> Vec<ConventionInfo>;
    fn list_modules(&self) -> Vec<ModuleCatalogEntry>;

    // ── Learning ───────────────────────────────────────────────────

    fn get_module_learning_viewport(&self, module_id: &str) -> Option<ModuleLearningViewport>;
    fn get_bundle_flow_tree(&self, bundle_id: &str) -> Option<BundleFlowTreeViewport>;
    fn get_module_flow_tree(&self, module_id: &str) -> Option<ModuleFlowTreeViewport>;

    // ── Evaluation (stateless) ─────────────────────────────────────

    fn evaluate_atom(
        &mut self,
        bundle_id: &str,
        atom_id: &str,
        seed: u64,
        vuln: Option<Vulnerability>,
        base_system: Option<&str>,
    ) -> Result<BiddingViewport, ServiceError>;

    fn grade_atom(
        &mut self,
        bundle_id: &str,
        atom_id: &str,
        seed: u64,
        bid: &str,
        vuln: Option<Vulnerability>,
        base_system: Option<&str>,
    ) -> Result<AtomGradeResult, ServiceError>;

    fn start_playthrough(
        &mut self,
        bundle_id: &str,
        seed: u64,
        vuln: Option<Vulnerability>,
        opponents: Option<OpponentMode>,
        base_system: Option<&str>,
    ) -> Result<PlaythroughStartResult, ServiceError>;

    fn get_playthrough_step(
        &self,
        bundle_id: &str,
        seed: u64,
        step_idx: usize,
        vuln: Option<Vulnerability>,
        opponents: Option<OpponentMode>,
        base_system: Option<&str>,
    ) -> Result<BiddingViewport, ServiceError>;

    fn grade_playthrough_bid(
        &mut self,
        bundle_id: &str,
        seed: u64,
        step_idx: usize,
        bid: &str,
        vuln: Option<Vulnerability>,
        opponents: Option<OpponentMode>,
        base_system: Option<&str>,
    ) -> Result<PlaythroughGradeResult, ServiceError>;
}

/// Debug service methods — separate trait for feature-gating.
pub trait DevServicePort: ServicePort {
    /// Get the expected bid from convention strategy.
    fn get_expected_bid(&self, handle: &str) -> Result<Option<Call>, ServiceError>;

    /// Get a debug snapshot of the current session state.
    fn get_debug_snapshot(&self, handle: &str) -> Result<serde_json::Value, ServiceError>;

    /// Get the debug log (list of events).
    fn get_debug_log(&self, handle: &str) -> Result<Vec<serde_json::Value>, ServiceError>;

    /// Get the inference timeline.
    fn get_inference_timeline(&self, handle: &str) -> Result<Vec<serde_json::Value>, ServiceError>;

    /// Get play suggestions from heuristic chain.
    fn get_play_suggestions(&self, handle: &str) -> Result<serde_json::Value, ServiceError>;

    /// Get the convention name for the active session.
    fn get_convention_name(&self, handle: &str) -> Result<String, ServiceError>;
}
