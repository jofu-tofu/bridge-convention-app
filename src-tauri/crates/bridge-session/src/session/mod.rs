//! Session state and drill lifecycle — per-session mutable state, drill session
//! management, configuration factory, drill startup orchestration, and controllers.
//!
//! Ported from TS `src/session/{session-state,drill-session,config-factory,start-drill,
//! bidding-controller,play-controller,bid-feedback-builder}.ts`.

pub mod bid_feedback_builder;
pub mod bidding_controller;
pub mod build_viewport;
pub mod config_factory;
pub mod drill_session;
pub mod flow_tree;
pub mod format_obs_label;
pub mod learning_viewport;
pub mod play_controller;
pub mod practice_focus;
pub mod session_state;
pub mod start_drill;

pub use bid_feedback_builder::{assemble_bid_feedback, call_equals, BidFeedbackDTO, BidGrade};
pub use bidding_controller::{
    initialize_auction, process_bid, run_initial_ai_bids, AiBidEntry, BidProcessResult,
};
pub use build_viewport::{
    build_auction_entries, build_bidding_viewport, build_declarer_prompt_viewport,
    build_explanation_viewport, build_playing_viewport, filter_visible_hands, format_call,
    AnnotationType, AuctionEntryView, BidContextView, BidHistoryEntryView, BidRole,
    BiddingOptionView, BiddingViewport, BuildBiddingViewportInput,
    BuildDeclarerPromptViewportInput, BuildExplanationViewportInput, BuildPlayingViewportInput,
    CallRoleEntry, DeclarerPromptViewport, ExplanationViewport, HandEvaluationView,
    PlayRecommendation, PlayingViewport,
};
pub use config_factory::{create_drill_config, DrillConfig};
pub use drill_session::get_next_bid;
pub use flow_tree::{
    build_bundle_flow_tree, build_module_flow_tree, BundleFlowTreeViewport, FlowTreeNode,
    ModuleFlowTreeViewport,
};
pub use format_obs_label::{format_obs_action, format_transition_label};
pub use learning_viewport::{
    build_base_module_infos, build_module_catalog, build_module_learning_viewport, call_key,
    compute_post_fit_phases, derive_entry_condition, derive_neutral_description,
    derive_phase_order, find_explanation_text, format_bid_references, format_module_name,
    map_clauses, module_surfaces, BaseModuleInfo, ClauseSystemVariant, EntryCondition,
    LearningTeachingView, ModuleCatalogEntry, ModuleLearningViewport, PhaseGroupView,
    RelevantMetric, ServiceTeachingLabel, SurfaceClauseView, SurfaceDetailView,
};
pub use play_controller::{
    process_play_card, process_single_card, run_initial_ai_plays, AiPlayEntry, PlayCardResult,
    SingleCardResult,
};
pub use session_state::{get_current_turn, DebugLogEntry, PlayState, SeatStrategy, SessionState};
pub use start_drill::{
    pick_vulnerability, rotate_auction, rotate_deal_constraints, rotate_seat_180, start_drill,
    DrillBundle,
};
