//! Tauri command handlers that delegate to ServicePort.
//!
//! Each #[tauri::command] locks the managed ServicePortImpl Mutex
//! and calls the corresponding ServicePort/DevServicePort method.

use std::sync::Mutex;

use bridge_engine::types::{Call, Card, Seat};
use bridge_service::error::ServiceError;
use bridge_service::response_types::*;
use bridge_service::{DevServicePort, ServicePort, ServicePortImpl, SessionConfig};
use bridge_session::session::{
    BiddingViewport, BundleFlowTreeViewport, DeclarerPromptViewport, ExplanationViewport,
    ModuleCatalogEntry, ModuleFlowTreeViewport, ModuleLearningViewport, PlayCardResult,
    PlayingViewport, SingleCardResult,
};

/// Managed state type alias.
pub type ServiceState = Mutex<ServicePortImpl>;

fn with_service<T>(
    state: tauri::State<'_, ServiceState>,
    f: impl FnOnce(&ServicePortImpl) -> Result<T, ServiceError>,
) -> Result<T, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    f(&service).map_err(|e| e.to_string())
}

fn with_service_mut<T>(
    state: tauri::State<'_, ServiceState>,
    f: impl FnOnce(&mut ServicePortImpl) -> Result<T, ServiceError>,
) -> Result<T, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    f(&mut service).map_err(|e| e.to_string())
}

// ── Session lifecycle ─────────────────────────────────────────────

#[tauri::command]
pub fn create_session(
    state: tauri::State<ServiceState>,
    config: SessionConfig,
) -> Result<String, String> {
    with_service_mut(state, |service| service.create_session(config))
}

#[tauri::command]
pub fn start_drill(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<DrillStartResult, String> {
    with_service_mut(state, |service| service.start_drill(&handle))
}

// ── Bidding ───────────────────────────────────────────────────────

#[tauri::command]
pub fn submit_bid(
    state: tauri::State<ServiceState>,
    handle: String,
    call: Call,
) -> Result<BidSubmitResult, String> {
    with_service_mut(state, |service| service.submit_bid(&handle, call))
}

// ── Phase transitions ─────────────────────────────────────────────

#[tauri::command]
pub fn accept_prompt(
    state: tauri::State<ServiceState>,
    handle: String,
    mode: Option<String>,
    seat_override: Option<Seat>,
) -> Result<PromptAcceptResult, String> {
    with_service_mut(state, |service| {
        service.accept_prompt(&handle, mode.as_deref(), seat_override)
    })
}

// ── Play ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn play_card(
    state: tauri::State<ServiceState>,
    handle: String,
    card: Card,
    seat: Seat,
) -> Result<PlayCardResult, String> {
    with_service_mut(state, |service| service.play_card(&handle, card, seat))
}

#[tauri::command]
pub fn play_single_card(
    state: tauri::State<ServiceState>,
    handle: String,
    card: Card,
    seat: Seat,
) -> Result<SingleCardResult, String> {
    with_service_mut(state, |service| {
        service.play_single_card(&handle, card, seat)
    })
}

#[tauri::command]
pub fn skip_to_review(state: tauri::State<ServiceState>, handle: String) -> Result<(), String> {
    with_service_mut(state, |service| service.skip_to_review(&handle))
}

#[tauri::command]
pub fn update_play_profile(
    state: tauri::State<ServiceState>,
    handle: String,
    profile_id: String,
) -> Result<(), String> {
    with_service_mut(state, |service| {
        service.update_play_profile(&handle, &profile_id)
    })
}

// ── Query (viewport getters) ──────────────────────────────────────

#[tauri::command]
pub fn get_bidding_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<BiddingViewport>, String> {
    with_service(state, |service| service.get_bidding_viewport(&handle))
}

#[tauri::command]
pub fn get_declarer_prompt_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<DeclarerPromptViewport>, String> {
    with_service(state, |service| {
        service.get_declarer_prompt_viewport(&handle)
    })
}

#[tauri::command]
pub fn get_playing_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<PlayingViewport>, String> {
    with_service(state, |service| service.get_playing_viewport(&handle))
}

#[tauri::command]
pub fn get_explanation_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<ExplanationViewport>, String> {
    with_service(state, |service| service.get_explanation_viewport(&handle))
}

// ── Inference ─────────────────────────────────────────────────────

#[tauri::command]
pub fn get_public_belief_state(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<ServicePublicBeliefState, String> {
    with_service(state, |service| service.get_public_belief_state(&handle))
}

// ── DDS ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_dds_solution(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<DDSolutionResult, String> {
    with_service(state, |service| service.get_dds_solution(&handle))
}

#[tauri::command]
pub fn get_deal_pbn(state: tauri::State<ServiceState>, handle: String) -> Result<String, String> {
    with_service(state, |service| service.get_deal_pbn(&handle))
}

// ── Catalog ───────────────────────────────────────────────────────

#[tauri::command]
pub fn list_conventions(state: tauri::State<ServiceState>) -> Result<Vec<ConventionInfo>, String> {
    with_service(state, |service| Ok(service.list_conventions()))
}

#[tauri::command]
pub fn list_modules(state: tauri::State<ServiceState>) -> Result<Vec<ModuleCatalogEntry>, String> {
    with_service(state, |service| Ok(service.list_modules()))
}

// ── Learning ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_module_learning_viewport(
    state: tauri::State<ServiceState>,
    module_id: String,
) -> Result<Option<ModuleLearningViewport>, String> {
    with_service(state, |service| {
        Ok(service.get_module_learning_viewport(&module_id))
    })
}

#[tauri::command]
pub fn get_bundle_flow_tree(
    state: tauri::State<ServiceState>,
    bundle_id: String,
) -> Result<Option<BundleFlowTreeViewport>, String> {
    with_service(
        state,
        |service| Ok(service.get_bundle_flow_tree(&bundle_id)),
    )
}

#[tauri::command]
pub fn get_module_flow_tree(
    state: tauri::State<ServiceState>,
    module_id: String,
) -> Result<Option<ModuleFlowTreeViewport>, String> {
    with_service(
        state,
        |service| Ok(service.get_module_flow_tree(&module_id)),
    )
}

// ── Dev/debug ─────────────────────────────────────────────────────

#[tauri::command]
pub fn get_expected_bid(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<Call>, String> {
    with_service(state, |service| service.get_expected_bid(&handle))
}

#[tauri::command]
pub fn get_debug_log(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Vec<ServiceDebugLogEntryDTO>, String> {
    with_service(state, |service| service.get_debug_log(&handle))
}

#[tauri::command]
pub fn get_inference_timeline(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Vec<InferenceTimelineEntryDTO>, String> {
    with_service(state, |service| service.get_inference_timeline(&handle))
}

#[tauri::command]
pub fn get_convention_name(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<String, String> {
    with_service(state, |service| service.get_convention_name(&handle))
}
