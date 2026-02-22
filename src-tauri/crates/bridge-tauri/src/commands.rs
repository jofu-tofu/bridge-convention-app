use bridge_engine::types::{
    Auction, AuctionEntry, Call, Card, Contract, DDSolution, Deal, DealConstraints, Hand,
    HandEvaluation, Seat, Suit, SuitLength, Trick, Vulnerability,
};

#[tauri::command]
pub fn generate_deal(constraints: DealConstraints) -> Result<Deal, String> {
    let result = bridge_engine::generate_deal(&constraints).map_err(|e| e.to_string())?;
    Ok(result.deal)
}

#[tauri::command]
pub fn evaluate_hand(hand: Hand) -> Result<HandEvaluation, String> {
    Ok(bridge_engine::evaluate_hand_hcp(&hand))
}

#[tauri::command]
pub fn get_suit_length(hand: Hand) -> Result<SuitLength, String> {
    Ok(bridge_engine::get_suit_length(&hand))
}

#[tauri::command]
pub fn is_balanced(hand: Hand) -> Result<bool, String> {
    let shape = bridge_engine::get_suit_length(&hand);
    Ok(bridge_engine::hand_evaluator::is_balanced(&shape))
}

#[tauri::command]
pub fn get_legal_calls(auction: Auction, seat: Seat) -> Result<Vec<Call>, String> {
    Ok(bridge_engine::get_legal_calls(&auction, seat))
}

#[tauri::command]
pub fn add_call(auction: Auction, entry: AuctionEntry) -> Result<Auction, String> {
    bridge_engine::add_call(&auction, entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_auction_complete(auction: Auction) -> Result<bool, String> {
    Ok(bridge_engine::is_auction_complete(&auction))
}

#[tauri::command]
pub fn get_contract(auction: Auction) -> Result<Option<Contract>, String> {
    bridge_engine::get_contract(&auction).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calculate_score(
    contract: Contract,
    tricks_won: u8,
    vulnerability: Vulnerability,
) -> Result<i32, String> {
    Ok(bridge_engine::calculate_score(&contract, tricks_won, vulnerability))
}

#[tauri::command]
pub fn get_legal_plays(hand: Hand, lead_suit: Option<Suit>) -> Result<Vec<Card>, String> {
    Ok(bridge_engine::get_legal_plays(&hand, lead_suit))
}

#[tauri::command]
pub fn get_trick_winner(trick: Trick) -> Result<Seat, String> {
    bridge_engine::get_trick_winner(&trick).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn solve_deal(deal: Deal) -> Result<DDSolution, String> {
    #[cfg(feature = "dds")]
    {
        bridge_engine::dds::solve_deal_with_par(&deal).map_err(|e| e.to_string())
    }
    #[cfg(not(feature = "dds"))]
    {
        let _ = deal;
        Err("DDS not available".to_string())
    }
}
