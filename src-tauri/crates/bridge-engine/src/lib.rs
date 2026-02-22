pub mod types;
pub mod error;
pub mod constants;
pub mod hand_evaluator;
pub mod deal_generator;
pub mod auction;
pub mod scoring;
pub mod play;

// Re-export commonly used items
pub use types::*;
pub use error::EngineError;
pub use constants::{create_deck, create_hand, next_seat, partner_seat};
pub use hand_evaluator::{
    calculate_hcp, evaluate_hand, evaluate_hand_hcp, get_suit_length, is_balanced,
    calculate_distribution_points, HcpStrategy,
};
pub use deal_generator::generate_deal;
pub use auction::{
    add_call, compare_bids, get_contract, get_declarer, get_legal_calls,
    is_auction_complete, is_legal_call,
};
pub use scoring::calculate_score;
pub use play::{get_legal_plays, get_trick_winner};
