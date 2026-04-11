pub mod auction;
pub mod constants;
pub mod deal_generator;
pub mod error;
pub mod hand_evaluator;
pub mod play;
pub mod scoring;
pub mod strategy;
pub mod types;

// Re-export commonly used items
pub use auction::{
    add_call, compare_bids, get_contract, get_declarer, get_legal_calls, is_auction_complete,
    is_legal_call,
};
pub use constants::{bid_suit_to_suit, create_deck, create_hand, next_seat, partner_seat, SEATS};
pub use deal_generator::generate_deal;
pub use error::EngineError;
pub use hand_evaluator::{
    calculate_distribution_points, calculate_hcp, evaluate_hand, evaluate_hand_hcp,
    get_suit_length, is_balanced, HcpStrategy,
};
pub use play::{get_legal_plays, get_trick_winner};
pub use scoring::calculate_score;
pub use types::*;
