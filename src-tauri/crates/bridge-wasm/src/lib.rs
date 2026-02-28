use serde::Deserialize;
use wasm_bindgen::prelude::*;

use bridge_engine::types::{
    Auction, AuctionEntry, Contract, DealConstraints, Hand, Seat, Suit, Trick, Vulnerability,
};

fn to_js<T: serde::Serialize>(val: &T) -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    val.serialize(&serializer)
        .map_err(|e| JsError::new(&e.to_string()))
}

fn from_js<T: serde::de::DeserializeOwned>(val: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))
}

// --- Request structs (transport-specific, same pattern as bridge-server) ---

#[derive(Deserialize)]
struct GenerateDealReq {
    constraints: DealConstraints,
}

#[derive(Deserialize)]
struct EvaluateHandReq {
    hand: Hand,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetLegalCallsReq {
    auction: Auction,
    seat: Seat,
}

#[derive(Deserialize)]
struct AddCallReq {
    auction: Auction,
    entry: AuctionEntry,
}

#[derive(Deserialize)]
struct AuctionReq {
    auction: Auction,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CalculateScoreReq {
    contract: Contract,
    tricks_won: u8,
    vulnerability: Vulnerability,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetLegalPlaysReq {
    hand: Hand,
    lead_suit: Option<Suit>,
}

#[derive(Deserialize)]
struct GetTrickWinnerReq {
    trick: Trick,
}

// --- WASM exports ---

#[wasm_bindgen]
pub fn generate_deal(input: JsValue) -> Result<JsValue, JsError> {
    let req: GenerateDealReq = from_js(input)?;
    let result = bridge_engine::generate_deal(&req.constraints)
        .map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&result.deal)
}

#[wasm_bindgen]
pub fn evaluate_hand(input: JsValue) -> Result<JsValue, JsError> {
    let req: EvaluateHandReq = from_js(input)?;
    let eval = bridge_engine::evaluate_hand_hcp(&req.hand);
    to_js(&eval)
}

#[wasm_bindgen]
pub fn get_suit_length(input: JsValue) -> Result<JsValue, JsError> {
    let req: EvaluateHandReq = from_js(input)?;
    let shape = bridge_engine::get_suit_length(&req.hand);
    to_js(&shape)
}

#[wasm_bindgen]
pub fn is_balanced(input: JsValue) -> Result<JsValue, JsError> {
    let req: EvaluateHandReq = from_js(input)?;
    let shape = bridge_engine::get_suit_length(&req.hand);
    let balanced = bridge_engine::hand_evaluator::is_balanced(&shape);
    to_js(&balanced)
}

#[wasm_bindgen]
pub fn get_legal_calls(input: JsValue) -> Result<JsValue, JsError> {
    let req: GetLegalCallsReq = from_js(input)?;
    let calls = bridge_engine::get_legal_calls(&req.auction, req.seat);
    to_js(&calls)
}

#[wasm_bindgen]
pub fn add_call(input: JsValue) -> Result<JsValue, JsError> {
    let req: AddCallReq = from_js(input)?;
    let auction = bridge_engine::add_call(&req.auction, req.entry)
        .map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&auction)
}

#[wasm_bindgen]
pub fn is_auction_complete(input: JsValue) -> Result<JsValue, JsError> {
    let req: AuctionReq = from_js(input)?;
    let complete = bridge_engine::is_auction_complete(&req.auction);
    to_js(&complete)
}

#[wasm_bindgen]
pub fn get_contract(input: JsValue) -> Result<JsValue, JsError> {
    let req: AuctionReq = from_js(input)?;
    let contract = bridge_engine::get_contract(&req.auction)
        .map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&contract)
}

#[wasm_bindgen]
pub fn calculate_score(input: JsValue) -> Result<JsValue, JsError> {
    let req: CalculateScoreReq = from_js(input)?;
    let score = bridge_engine::calculate_score(&req.contract, req.tricks_won, req.vulnerability);
    to_js(&score)
}

#[wasm_bindgen]
pub fn get_legal_plays(input: JsValue) -> Result<JsValue, JsError> {
    let req: GetLegalPlaysReq = from_js(input)?;
    let plays = bridge_engine::get_legal_plays(&req.hand, req.lead_suit);
    to_js(&plays)
}

#[wasm_bindgen]
pub fn get_trick_winner(input: JsValue) -> Result<JsValue, JsError> {
    let req: GetTrickWinnerReq = from_js(input)?;
    let winner = bridge_engine::get_trick_winner(&req.trick)
        .map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&winner)
}
