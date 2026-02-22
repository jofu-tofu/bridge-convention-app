use axum::{
    extract::Json,
    http::StatusCode,
    routing::post,
    Router,
};
use serde::Deserialize;

use bridge_engine::types::{
    Auction, AuctionEntry, Call, Card, Contract, DDSolution, Deal, DealConstraints, Hand,
    HandEvaluation, Seat, Suit, SuitLength, Trick, Vulnerability,
};

/// Helper to convert EngineError → (400, error text)
fn engine_err(e: bridge_engine::EngineError) -> (StatusCode, String) {
    (StatusCode::BAD_REQUEST, e.to_string())
}

// --- Request structs ---

#[derive(Deserialize)]
pub struct GenerateDealReq {
    constraints: DealConstraints,
}

#[derive(Deserialize)]
pub struct EvaluateHandReq {
    hand: Hand,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetLegalCallsReq {
    auction: Auction,
    seat: Seat,
}

#[derive(Deserialize)]
pub struct AddCallReq {
    auction: Auction,
    entry: AuctionEntry,
}

#[derive(Deserialize)]
pub struct AuctionReq {
    auction: Auction,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculateScoreReq {
    contract: Contract,
    tricks_won: u8,
    vulnerability: Vulnerability,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetLegalPlaysReq {
    hand: Hand,
    lead_suit: Option<Suit>,
}

#[derive(Deserialize)]
pub struct GetTrickWinnerReq {
    trick: Trick,
}

#[derive(Deserialize)]
pub struct SolveDealReq {
    deal: Deal,
}

// --- Route handlers ---

async fn generate_deal(Json(req): Json<GenerateDealReq>) -> Result<Json<Deal>, (StatusCode, String)> {
    let result = bridge_engine::generate_deal(&req.constraints).map_err(engine_err)?;
    Ok(Json(result.deal))
}

async fn evaluate_hand(Json(req): Json<EvaluateHandReq>) -> Json<HandEvaluation> {
    Json(bridge_engine::evaluate_hand_hcp(&req.hand))
}

async fn get_suit_length(Json(req): Json<EvaluateHandReq>) -> Json<SuitLength> {
    Json(bridge_engine::get_suit_length(&req.hand))
}

async fn is_balanced(Json(req): Json<EvaluateHandReq>) -> Json<bool> {
    let shape = bridge_engine::get_suit_length(&req.hand);
    Json(bridge_engine::hand_evaluator::is_balanced(&shape))
}

async fn get_legal_calls(Json(req): Json<GetLegalCallsReq>) -> Json<Vec<Call>> {
    Json(bridge_engine::get_legal_calls(&req.auction, req.seat))
}

async fn add_call(Json(req): Json<AddCallReq>) -> Result<Json<Auction>, (StatusCode, String)> {
    let result = bridge_engine::add_call(&req.auction, req.entry).map_err(engine_err)?;
    Ok(Json(result))
}

async fn is_auction_complete(Json(req): Json<AuctionReq>) -> Json<bool> {
    Json(bridge_engine::is_auction_complete(&req.auction))
}

async fn get_contract(Json(req): Json<AuctionReq>) -> Result<Json<Option<Contract>>, (StatusCode, String)> {
    let result = bridge_engine::get_contract(&req.auction).map_err(engine_err)?;
    Ok(Json(result))
}

async fn calculate_score(Json(req): Json<CalculateScoreReq>) -> Json<i32> {
    Json(bridge_engine::calculate_score(
        &req.contract,
        req.tricks_won,
        req.vulnerability,
    ))
}

async fn get_legal_plays(Json(req): Json<GetLegalPlaysReq>) -> Json<Vec<Card>> {
    Json(bridge_engine::get_legal_plays(&req.hand, req.lead_suit))
}

async fn get_trick_winner(Json(req): Json<GetTrickWinnerReq>) -> Result<Json<Seat>, (StatusCode, String)> {
    let result = bridge_engine::get_trick_winner(&req.trick).map_err(engine_err)?;
    Ok(Json(result))
}

#[cfg(feature = "dds")]
async fn solve_deal(Json(req): Json<SolveDealReq>) -> Result<Json<DDSolution>, (StatusCode, String)> {
    let result = bridge_engine::dds::solve_deal_with_par(&req.deal).map_err(engine_err)?;
    Ok(Json(result))
}

#[cfg(not(feature = "dds"))]
async fn solve_deal(Json(_req): Json<SolveDealReq>) -> Result<Json<DDSolution>, (StatusCode, String)> {
    Err((StatusCode::SERVICE_UNAVAILABLE, "DDS not available".to_string()))
}

// --- Router ---

pub fn api_routes() -> Router {
    Router::new()
        .route("/generate_deal", post(generate_deal))
        .route("/evaluate_hand", post(evaluate_hand))
        .route("/get_suit_length", post(get_suit_length))
        .route("/is_balanced", post(is_balanced))
        .route("/get_legal_calls", post(get_legal_calls))
        .route("/add_call", post(add_call))
        .route("/is_auction_complete", post(is_auction_complete))
        .route("/get_contract", post(get_contract))
        .route("/calculate_score", post(calculate_score))
        .route("/get_legal_plays", post(get_legal_plays))
        .route("/get_trick_winner", post(get_trick_winner))
        .route("/solve_deal", post(solve_deal))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    fn app() -> Router {
        Router::new().nest("/api", api_routes())
    }

    async fn post_json(uri: &str, body: &str) -> (StatusCode, String) {
        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();

        let response = app().oneshot(req).await.unwrap();
        let status = response.status();
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        (status, text)
    }

    #[tokio::test]
    async fn evaluate_hand_returns_hcp() {
        let body = r#"{"hand":{"cards":[
            {"suit":"S","rank":"A"},{"suit":"S","rank":"K"},{"suit":"S","rank":"Q"},{"suit":"S","rank":"J"},
            {"suit":"H","rank":"A"},{"suit":"H","rank":"K"},{"suit":"H","rank":"Q"},
            {"suit":"D","rank":"A"},{"suit":"D","rank":"K"},{"suit":"D","rank":"Q"},
            {"suit":"C","rank":"A"},{"suit":"C","rank":"K"},{"suit":"C","rank":"Q"}
        ]}}"#;
        let (status, text) = post_json("/api/evaluate_hand", body).await;
        assert_eq!(status, StatusCode::OK);
        let eval: HandEvaluation = serde_json::from_str(&text).unwrap();
        assert_eq!(eval.hcp, 37);
    }

    #[tokio::test]
    async fn get_suit_length_returns_array() {
        let body = r#"{"hand":{"cards":[
            {"suit":"S","rank":"A"},{"suit":"S","rank":"K"},{"suit":"S","rank":"Q"},{"suit":"S","rank":"J"},
            {"suit":"H","rank":"A"},{"suit":"H","rank":"K"},{"suit":"H","rank":"Q"},
            {"suit":"D","rank":"A"},{"suit":"D","rank":"K"},{"suit":"D","rank":"Q"},
            {"suit":"C","rank":"A"},{"suit":"C","rank":"K"},{"suit":"C","rank":"Q"}
        ]}}"#;
        let (status, text) = post_json("/api/get_suit_length", body).await;
        assert_eq!(status, StatusCode::OK);
        let shape: SuitLength = serde_json::from_str(&text).unwrap();
        assert_eq!(shape, [4, 3, 3, 3]);
    }

    #[tokio::test]
    async fn is_balanced_returns_bool() {
        let body = r#"{"hand":{"cards":[
            {"suit":"S","rank":"A"},{"suit":"S","rank":"K"},{"suit":"S","rank":"Q"},{"suit":"S","rank":"J"},
            {"suit":"H","rank":"A"},{"suit":"H","rank":"K"},{"suit":"H","rank":"Q"},
            {"suit":"D","rank":"A"},{"suit":"D","rank":"K"},{"suit":"D","rank":"Q"},
            {"suit":"C","rank":"A"},{"suit":"C","rank":"K"},{"suit":"C","rank":"Q"}
        ]}}"#;
        let (status, text) = post_json("/api/is_balanced", body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "true");
    }

    #[tokio::test]
    async fn generate_deal_works() {
        let body = r#"{"constraints":{"seats":[],"seed":42}}"#;
        let (status, text) = post_json("/api/generate_deal", body).await;
        assert_eq!(status, StatusCode::OK);
        let deal: Deal = serde_json::from_str(&text).unwrap();
        assert_eq!(deal.hands.len(), 4);
    }

    #[tokio::test]
    async fn get_legal_calls_opening() {
        let body = r#"{"auction":{"entries":[],"isComplete":false},"seat":"N"}"#;
        let (status, text) = post_json("/api/get_legal_calls", body).await;
        assert_eq!(status, StatusCode::OK);
        let calls: Vec<Call> = serde_json::from_str(&text).unwrap();
        assert_eq!(calls.len(), 36); // pass + 35 bids
    }

    #[tokio::test]
    async fn add_call_legal() {
        let body = r#"{"auction":{"entries":[],"isComplete":false},"entry":{"seat":"N","call":{"type":"bid","level":1,"strain":"C"}}}"#;
        let (status, text) = post_json("/api/add_call", body).await;
        assert_eq!(status, StatusCode::OK);
        let auction: Auction = serde_json::from_str(&text).unwrap();
        assert_eq!(auction.entries.len(), 1);
    }

    #[tokio::test]
    async fn add_call_illegal_returns_400() {
        let body = r#"{"auction":{"entries":[],"isComplete":false},"entry":{"seat":"N","call":{"type":"double"}}}"#;
        let (status, _text) = post_json("/api/add_call", body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn is_auction_complete_false() {
        let body = r#"{"auction":{"entries":[],"isComplete":false}}"#;
        let (status, text) = post_json("/api/is_auction_complete", body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "false");
    }

    #[tokio::test]
    async fn get_contract_passout() {
        let body = r#"{"auction":{"entries":[
            {"seat":"N","call":{"type":"pass"}},
            {"seat":"E","call":{"type":"pass"}},
            {"seat":"S","call":{"type":"pass"}},
            {"seat":"W","call":{"type":"pass"}}
        ],"isComplete":true}}"#;
        let (status, text) = post_json("/api/get_contract", body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "null");
    }

    #[tokio::test]
    async fn calculate_score_making() {
        let body = r#"{"contract":{"level":3,"strain":"NT","doubled":false,"redoubled":false,"declarer":"S"},"tricksWon":9,"vulnerability":"None"}"#;
        let (status, text) = post_json("/api/calculate_score", body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "400");
    }

    #[tokio::test]
    async fn get_legal_plays_follow_suit() {
        let body = r#"{"hand":{"cards":[
            {"suit":"S","rank":"A"},{"suit":"S","rank":"K"},{"suit":"H","rank":"Q"}
        ]},"leadSuit":"S"}"#;
        let (status, text) = post_json("/api/get_legal_plays", body).await;
        assert_eq!(status, StatusCode::OK);
        let cards: Vec<Card> = serde_json::from_str(&text).unwrap();
        assert_eq!(cards.len(), 2);
    }

    #[tokio::test]
    async fn get_legal_plays_no_lead() {
        let body = r#"{"hand":{"cards":[
            {"suit":"S","rank":"A"},{"suit":"H","rank":"K"},{"suit":"D","rank":"Q"}
        ]},"leadSuit":null}"#;
        let (status, text) = post_json("/api/get_legal_plays", body).await;
        assert_eq!(status, StatusCode::OK);
        let cards: Vec<Card> = serde_json::from_str(&text).unwrap();
        assert_eq!(cards.len(), 3);
    }

    #[tokio::test]
    async fn get_trick_winner_ok() {
        let body = r#"{"trick":{"plays":[
            {"card":{"suit":"S","rank":"T"},"seat":"N"},
            {"card":{"suit":"S","rank":"J"},"seat":"E"},
            {"card":{"suit":"S","rank":"A"},"seat":"S"},
            {"card":{"suit":"S","rank":"K"},"seat":"W"}
        ],"trumpSuit":null,"winner":null}}"#;
        let (status, text) = post_json("/api/get_trick_winner", body).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "\"S\"");
    }

    #[tokio::test]
    async fn get_trick_winner_incomplete_400() {
        let body = r#"{"trick":{"plays":[],"trumpSuit":null,"winner":null}}"#;
        let (status, _) = post_json("/api/get_trick_winner", body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
}
