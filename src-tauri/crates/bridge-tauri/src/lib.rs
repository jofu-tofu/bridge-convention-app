mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_deal,
            commands::evaluate_hand,
            commands::get_suit_length,
            commands::is_balanced,
            commands::get_legal_calls,
            commands::add_call,
            commands::is_auction_complete,
            commands::get_contract,
            commands::calculate_score,
            commands::get_legal_plays,
            commands::get_trick_winner,
            commands::solve_deal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
