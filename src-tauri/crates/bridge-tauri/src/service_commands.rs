//! Tauri command handlers that delegate to ServicePort.
//!
//! Each #[tauri::command] locks the managed ServicePortImpl Mutex
//! and calls the corresponding ServicePort/DevServicePort method.

use std::sync::Mutex;

use bridge_engine::types::{Call, Card, Seat};
use bridge_service::response_types::*;
use bridge_service::{DevServicePort, ServicePort, ServicePortImpl, SessionConfig};
use bridge_session::session::{
    BiddingViewport, BundleFlowTreeViewport, DeclarerPromptViewport, ExplanationViewport,
    ModuleCatalogEntry, ModuleFlowTreeViewport, ModuleLearningViewport, PlayCardResult,
    PlayingViewport, SingleCardResult,
};

/// Managed state type alias.
pub type ServiceState = Mutex<ServicePortImpl>;

// ── Session lifecycle ─────────────────────────────────────────────

#[tauri::command]
pub fn create_session(
    state: tauri::State<ServiceState>,
    config: SessionConfig,
) -> Result<String, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service.create_session(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_drill(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<DrillStartResult, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service.start_drill(&handle).map_err(|e| e.to_string())
}

// ── Bidding ───────────────────────────────────────────────────────

#[tauri::command]
pub fn submit_bid(
    state: tauri::State<ServiceState>,
    handle: String,
    call: Call,
) -> Result<BidSubmitResult, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service.submit_bid(&handle, call).map_err(|e| e.to_string())
}

// ── Phase transitions ─────────────────────────────────────────────

#[tauri::command]
pub fn accept_prompt(
    state: tauri::State<ServiceState>,
    handle: String,
    mode: Option<String>,
    seat_override: Option<Seat>,
) -> Result<PromptAcceptResult, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service
        .accept_prompt(&handle, mode.as_deref(), seat_override)
        .map_err(|e| e.to_string())
}

// ── Play ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn play_card(
    state: tauri::State<ServiceState>,
    handle: String,
    card: Card,
    seat: Seat,
) -> Result<PlayCardResult, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service
        .play_card(&handle, card, seat)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn play_single_card(
    state: tauri::State<ServiceState>,
    handle: String,
    card: Card,
    seat: Seat,
) -> Result<SingleCardResult, String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service
        .play_single_card(&handle, card, seat)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn skip_to_review(state: tauri::State<ServiceState>, handle: String) -> Result<(), String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service.skip_to_review(&handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_play_profile(
    state: tauri::State<ServiceState>,
    handle: String,
    profile_id: String,
) -> Result<(), String> {
    let mut service = state.lock().map_err(|e| e.to_string())?;
    service
        .update_play_profile(&handle, &profile_id)
        .map_err(|e| e.to_string())
}

// ── Query (viewport getters) ──────────────────────────────────────

#[tauri::command]
pub fn get_bidding_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<BiddingViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_bidding_viewport(&handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_declarer_prompt_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<DeclarerPromptViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_declarer_prompt_viewport(&handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_playing_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<PlayingViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_playing_viewport(&handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_explanation_viewport(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<ExplanationViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_explanation_viewport(&handle)
        .map_err(|e| e.to_string())
}

// ── Inference ─────────────────────────────────────────────────────

#[tauri::command]
pub fn get_public_belief_state(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<ServicePublicBeliefState, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_public_belief_state(&handle)
        .map_err(|e| e.to_string())
}

// ── DDS ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_dds_solution(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<DDSolutionResult, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service.get_dds_solution(&handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_deal_pbn(state: tauri::State<ServiceState>, handle: String) -> Result<String, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service.get_deal_pbn(&handle).map_err(|e| e.to_string())
}

// ── Catalog ───────────────────────────────────────────────────────

#[tauri::command]
pub fn list_conventions(state: tauri::State<ServiceState>) -> Result<Vec<ConventionInfo>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    Ok(service.list_conventions())
}

#[tauri::command]
pub fn list_modules(state: tauri::State<ServiceState>) -> Result<Vec<ModuleCatalogEntry>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    Ok(service.list_modules())
}

// ── Learning ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_module_learning_viewport(
    state: tauri::State<ServiceState>,
    module_id: String,
) -> Result<Option<ModuleLearningViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    Ok(service.get_module_learning_viewport(&module_id))
}

#[tauri::command]
pub fn get_bundle_flow_tree(
    state: tauri::State<ServiceState>,
    bundle_id: String,
) -> Result<Option<BundleFlowTreeViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    Ok(service.get_bundle_flow_tree(&bundle_id))
}

#[tauri::command]
pub fn get_module_flow_tree(
    state: tauri::State<ServiceState>,
    module_id: String,
) -> Result<Option<ModuleFlowTreeViewport>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    Ok(service.get_module_flow_tree(&module_id))
}
// ── Dev/debug ─────────────────────────────────────────────────────

#[tauri::command]
pub fn get_expected_bid(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Option<Call>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service.get_expected_bid(&handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_debug_log(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Vec<serde_json::Value>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service.get_debug_log(&handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_inference_timeline(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<Vec<serde_json::Value>, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_inference_timeline(&handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_convention_name(
    state: tauri::State<ServiceState>,
    handle: String,
) -> Result<String, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service
        .get_convention_name(&handle)
        .map_err(|e| e.to_string())
}
