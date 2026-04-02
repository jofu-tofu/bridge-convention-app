//! Session state and drill lifecycle — per-session mutable state, drill session
//! management, configuration factory, drill startup orchestration, and controllers.
//!
//! Ported from TS `src/session/{session-state,drill-session,config-factory,start-drill,
//! bidding-controller,play-controller,bid-feedback-builder}.ts`.

pub mod session_state;
pub mod drill_session;
pub mod config_factory;
pub mod start_drill;
pub mod practice_focus;
pub mod bidding_controller;
pub mod play_controller;
pub mod bid_feedback_builder;
pub mod build_viewport;
pub mod flow_tree;
pub mod format_obs_label;
pub mod clause_mapper;
pub mod condition_caps;
pub mod learning_viewport;

pub use session_state::{SessionState, PlayState, SeatStrategy, get_current_turn};
pub use drill_session::get_next_bid;
pub use config_factory::{DrillConfig, create_drill_config};
pub use start_drill::{
    DrillBundle, pick_vulnerability, rotate_seat_180, rotate_deal_constraints,
    rotate_auction, start_drill,
};
pub use bidding_controller::{process_bid, run_initial_ai_bids, initialize_auction, BidProcessResult, AiBidEntry};
pub use play_controller::{process_play_card, process_single_card, run_initial_ai_plays, PlayCardResult, SingleCardResult, AiPlayEntry};
pub use bid_feedback_builder::{assemble_bid_feedback, BidFeedbackDTO, BidGrade, call_equals};
pub use build_viewport::{
    format_call, format_hand_summary, build_auction_entries, filter_visible_hands,
    build_bidding_viewport, build_declarer_prompt_viewport,
    build_playing_viewport, build_explanation_viewport,
    HandEvaluationView, AuctionEntryView, AnnotationType, BidHistoryEntryView,
    PlayRecommendation, BiddingViewport, DeclarerPromptViewport,
    PlayingViewport, ExplanationViewport,
    BuildBiddingViewportInput, BuildDeclarerPromptViewportInput,
    BuildPlayingViewportInput, BuildExplanationViewportInput,
};
pub use flow_tree::{
    build_bundle_flow_tree, build_module_flow_tree,
    FlowTreeNode, BundleFlowTreeViewport, ModuleFlowTreeViewport,
};
pub use format_obs_label::{format_obs_action, format_transition_label};
pub use learning_viewport::{
    format_module_name, format_bid_references, call_key, module_surfaces,
    build_module_catalog, build_base_module_infos, build_module_learning_viewport,
    derive_phase_order, compute_post_fit_phases, find_explanation_text,
    map_clauses, derive_entry_condition, derive_neutral_description,
    ModuleCatalogEntry, ModuleLearningViewport, LearningTeachingView,
    PhaseGroupView, SurfaceDetailView, SurfaceClauseView, ClauseSystemVariant,
    ServiceTeachingLabel, BaseModuleInfo, EntryCondition, RelevantMetric,
};
