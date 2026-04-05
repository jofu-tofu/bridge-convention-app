mod service_commands;

use bridge_service::ServicePortImpl;
use std::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(ServicePortImpl::new()))
        .invoke_handler(tauri::generate_handler![
            service_commands::create_drill_session,
            service_commands::start_drill,
            service_commands::submit_bid,
            service_commands::enter_play,
            service_commands::decline_play,
            service_commands::return_to_prompt,
            service_commands::restart_play,
            service_commands::play_card,
            service_commands::skip_to_review,
            service_commands::update_play_profile,
            service_commands::get_bidding_viewport,
            service_commands::get_declarer_prompt_viewport,
            service_commands::get_playing_viewport,
            service_commands::get_explanation_viewport,
            service_commands::get_public_belief_state,
            service_commands::get_dds_solution,
            service_commands::list_conventions,
            service_commands::list_modules,
            service_commands::get_module_learning_viewport,
            service_commands::get_bundle_flow_tree,
            service_commands::get_module_flow_tree,
            // Dev/debug
            service_commands::get_expected_bid,
            service_commands::get_debug_log,
            service_commands::get_inference_timeline,
            service_commands::get_convention_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
