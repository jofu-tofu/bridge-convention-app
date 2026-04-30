//! ServicePort and DevServicePort traits — the hexagonal boundary.
//!
//! All methods are synchronous. The UI/WASM layer calls these traits;
//! implementations delegate to bridge-session controllers.

use bridge_engine::types::{Call, Card, Seat};
use bridge_session::session::{
    BiddingViewport, DeclarerPromptViewport, ExplanationViewport, ModuleCatalogEntry,
    ModuleFlowTreeViewport, ModuleLearningViewport, PlayCardResult, PlayingViewport,
};

use crate::config_schema_types::{ModuleConfigSchemaView, ValidationResult};
use crate::error::ServiceError;
use crate::request_types::{DrillHandle, SessionConfig};
use crate::response_types::{
    BidSubmitResult, ConventionInfo, DDSolutionResult, DrillStartResult, InferenceTimelineEntryDTO,
    PlayEntryResult, ServiceDebugLogEntryDTO, ServicePublicBeliefState,
};

/// Production service interface — all methods synchronous.
pub trait ServicePort {
    // ── Session lifecycle ──────────────────────────────────────────

    /// Create a new drill session from configuration.
    fn create_drill_session(&mut self, config: SessionConfig) -> Result<DrillHandle, ServiceError>;

    /// Start the drill: generate deal, run initial AI bids, return viewport.
    fn start_drill(&mut self, handle: &str) -> Result<DrillStartResult, ServiceError>;

    // ── Bidding ────────────────────────────────────────────────────

    /// Submit a user bid, get grading + AI continuation.
    fn submit_bid(&mut self, handle: &str, call: Call) -> Result<BidSubmitResult, ServiceError>;

    // ── Phase transitions ──────────────────────────────────────────

    /// Enter the play phase from the declarer prompt.
    fn enter_play(
        &mut self,
        handle: &str,
        seat_override: Option<Seat>,
    ) -> Result<PlayEntryResult, ServiceError>;

    /// Decline play — skip directly to explanation.
    fn decline_play(&mut self, handle: &str) -> Result<(), ServiceError>;

    /// Return to the declarer prompt from explanation (replay).
    fn return_to_prompt(&mut self, handle: &str) -> Result<(), ServiceError>;

    /// Restart play from the current position.
    fn restart_play(&mut self, handle: &str) -> Result<PlayEntryResult, ServiceError>;

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
    fn get_module_flow_tree(&self, module_id: &str) -> Option<ModuleFlowTreeViewport>;

    // ── Workshop ──────────────────────────────────────────────────

    /// Fork a system module into a user module (deep copy with new ID + lineage).
    /// Returns the forked module as serialized JSON.
    fn fork_module(&self, source_module_id: &str) -> Result<String, ServiceError>;

    /// Get the configuration schema for a module (derived from its content).
    fn get_module_config_schema(
        &self,
        module_id: &str,
        user_modules_json: Option<&str>,
    ) -> Result<ModuleConfigSchemaView, ServiceError>;

    /// Validate a user module's content.
    fn validate_module(&self, module_json: &str) -> Result<ValidationResult, ServiceError>;
}

/// Debug service methods — separate trait for feature-gating.
pub trait DevServicePort: ServicePort {
    /// Get the expected bid from convention strategy.
    fn get_expected_bid(&self, handle: &str) -> Result<Option<Call>, ServiceError>;

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
