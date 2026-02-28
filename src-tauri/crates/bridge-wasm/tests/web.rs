use bridge_engine::types::*;
use serde::Serialize;
use wasm_bindgen_test::*;

fn to_js<T: Serialize>(val: &T) -> wasm_bindgen::JsValue {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    val.serialize(&serializer).unwrap()
}

#[derive(Serialize)]
struct GenerateDealReq {
    constraints: DealConstraints,
}

#[derive(Serialize)]
struct EvaluateHandReq {
    hand: Hand,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AddCallReq {
    auction: Auction,
    entry: AuctionEntry,
}

#[wasm_bindgen_test]
fn generate_deal_with_seed() {
    let input = to_js(&GenerateDealReq {
        constraints: DealConstraints {
            seats: vec![],
            seed: Some(42),
            vulnerability: None,
            dealer: None,
            max_attempts: None,
        },
    });

    let result = bridge_wasm::generate_deal(input).unwrap();
    let deal: serde_json::Value = serde_wasm_bindgen::from_value(result).unwrap();

    // Deal has hands, dealer, vulnerability
    let hands = deal["hands"].as_object().unwrap();
    assert_eq!(hands.len(), 4);
    assert!(hands.contains_key("N"));
    assert!(hands.contains_key("E"));
    assert!(hands.contains_key("S"));
    assert!(hands.contains_key("W"));

    // Each hand should have 13 cards
    for (_seat, hand) in hands {
        let cards = hand["cards"].as_array().unwrap();
        assert_eq!(cards.len(), 13);
    }
}

#[wasm_bindgen_test]
fn generate_deal_without_seed() {
    let input = to_js(&GenerateDealReq {
        constraints: DealConstraints {
            seats: vec![],
            seed: None,
            vulnerability: None,
            dealer: None,
            max_attempts: None,
        },
    });

    let result = bridge_wasm::generate_deal(input).unwrap();
    let deal: serde_json::Value = serde_wasm_bindgen::from_value(result).unwrap();
    let hands = deal["hands"].as_object().unwrap();
    assert_eq!(hands.len(), 4);
}

#[wasm_bindgen_test]
fn deal_hands_serialize_as_plain_object_not_map() {
    let input = to_js(&GenerateDealReq {
        constraints: DealConstraints {
            seats: vec![],
            seed: Some(42),
            vulnerability: None,
            dealer: None,
            max_attempts: None,
        },
    });

    let result = bridge_wasm::generate_deal(input).unwrap();
    // Verify hands is a plain JS object with N/E/S/W keys (not a Map)
    let deal: serde_json::Value = serde_wasm_bindgen::from_value(result).unwrap();
    let hands = deal["hands"].as_object().unwrap();
    let mut keys: Vec<&String> = hands.keys().collect();
    keys.sort();
    assert_eq!(keys, vec!["E", "N", "S", "W"]);
}

#[wasm_bindgen_test]
fn evaluate_hand_returns_correct_hcp() {
    // AKQJ of spades (10) + AKQ of hearts (9) + AKQ of diamonds (9) + AKQ of clubs (9) = 37 HCP
    let hand = Hand {
        cards: vec![
            Card { suit: Suit::Spades, rank: Rank::Ace },
            Card { suit: Suit::Spades, rank: Rank::King },
            Card { suit: Suit::Spades, rank: Rank::Queen },
            Card { suit: Suit::Spades, rank: Rank::Jack },
            Card { suit: Suit::Hearts, rank: Rank::Ace },
            Card { suit: Suit::Hearts, rank: Rank::King },
            Card { suit: Suit::Hearts, rank: Rank::Queen },
            Card { suit: Suit::Diamonds, rank: Rank::Ace },
            Card { suit: Suit::Diamonds, rank: Rank::King },
            Card { suit: Suit::Diamonds, rank: Rank::Queen },
            Card { suit: Suit::Clubs, rank: Rank::Ace },
            Card { suit: Suit::Clubs, rank: Rank::King },
            Card { suit: Suit::Clubs, rank: Rank::Queen },
        ],
    };
    let input = to_js(&EvaluateHandReq { hand });

    let result = bridge_wasm::evaluate_hand(input).unwrap();
    let eval: serde_json::Value = serde_wasm_bindgen::from_value(result).unwrap();
    assert_eq!(eval["hcp"], 37);
}

#[wasm_bindgen_test]
fn add_call_illegal_returns_error() {
    let input = to_js(&AddCallReq {
        auction: Auction {
            entries: vec![],
            is_complete: false,
        },
        entry: AuctionEntry {
            seat: Seat::North,
            call: Call::Double,
        },
    });

    let result = bridge_wasm::add_call(input);
    assert!(result.is_err());
}
