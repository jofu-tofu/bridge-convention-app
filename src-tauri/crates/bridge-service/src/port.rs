//! ServicePort and DevServicePort traits — the hexagonal boundary.
//!
//! All methods are synchronous. The UI/WASM layer calls these traits;
//! implementations delegate to bridge-session controllers.

use bridge_engine::types::{Call, Card, Seat};
use bridge_session::session::{
    BiddingViewport, BundleFlowTreeViewport, DeclarerPromptViewport, ExplanationViewport,
    ModuleCatalogEntry, ModuleFlowTreeViewport, ModuleLearningViewport, PlayCardResult,
    PlayingViewport, SingleCardResult,
};

use crate::error::ServiceError;
use crate::request_types::{SessionConfig, SessionHandle};
use crate::response_types::{
    BidSubmitResult, ConventionInfo, DDSolutionResult, DrillStartResult, InferenceTimelineEntryDTO,
    PromptAcceptResult, ServiceDebugLogEntryDTO, ServiceDebugSnapshotDTO, ServicePublicBeliefState,
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

    /// Play a single card without running the AI loop.
    /// Used by MC+DDS profiles where TS drives AI card selection.
    fn play_single_card(
        &mut self,
        handle: &str,
        card: Card,
        seat: Seat,
    ) -> Result<SingleCardResult, ServiceError>;

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

    /// Get the deal in PBN format for browser DDS solving.
    fn get_deal_pbn(&self, handle: &str) -> Result<String, ServiceError>;

    // ── Catalog ────────────────────────────────────────────────────

    fn list_conventions(&self) -> Vec<ConventionInfo>;
    fn list_modules(&self) -> Vec<ModuleCatalogEntry>;

    // ── Learning ───────────────────────────────────────────────────

    fn get_module_learning_viewport(&self, module_id: &str) -> Option<ModuleLearningViewport>;
    fn get_bundle_flow_tree(&self, bundle_id: &str) -> Option<BundleFlowTreeViewport>;
    fn get_module_flow_tree(&self, module_id: &str) -> Option<ModuleFlowTreeViewport>;
}

/// Debug service methods — separate trait for feature-gating.
pub trait DevServicePort: ServicePort {
    /// Get the expected bid from convention strategy.
    fn get_expected_bid(&self, handle: &str) -> Result<Option<Call>, ServiceError>;

    /// Get a debug snapshot of the current session state.
    fn get_debug_snapshot(&self, handle: &str) -> Result<ServiceDebugSnapshotDTO, ServiceError>;

    /// Get the debug log (list of events).
    fn get_debug_log(&self, handle: &str) -> Result<Vec<ServiceDebugLogEntryDTO>, ServiceError>;

    /// Get the inference timeline.
    fn get_inference_timeline(
        &self,
        handle: &str,
    ) -> Result<Vec<InferenceTimelineEntryDTO>, ServiceError>;

    /// Get the convention name for the active session.
    fn get_convention_name(&self, handle: &str) -> Result<String, ServiceError>;
}
