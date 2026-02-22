use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- Enums matching TS string values ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Suit {
    #[serde(rename = "C")]
    Clubs,
    #[serde(rename = "D")]
    Diamonds,
    #[serde(rename = "H")]
    Hearts,
    #[serde(rename = "S")]
    Spades,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Rank {
    #[serde(rename = "2")]
    Two,
    #[serde(rename = "3")]
    Three,
    #[serde(rename = "4")]
    Four,
    #[serde(rename = "5")]
    Five,
    #[serde(rename = "6")]
    Six,
    #[serde(rename = "7")]
    Seven,
    #[serde(rename = "8")]
    Eight,
    #[serde(rename = "9")]
    Nine,
    #[serde(rename = "T")]
    Ten,
    #[serde(rename = "J")]
    Jack,
    #[serde(rename = "Q")]
    Queen,
    #[serde(rename = "K")]
    King,
    #[serde(rename = "A")]
    Ace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
pub enum Seat {
    #[serde(rename = "N")]
    North,
    #[serde(rename = "E")]
    East,
    #[serde(rename = "S")]
    South,
    #[serde(rename = "W")]
    West,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Vulnerability {
    #[serde(rename = "None")]
    None,
    #[serde(rename = "NS")]
    NorthSouth,
    #[serde(rename = "EW")]
    EastWest,
    #[serde(rename = "Both")]
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BidSuit {
    #[serde(rename = "C")]
    Clubs,
    #[serde(rename = "D")]
    Diamonds,
    #[serde(rename = "H")]
    Hearts,
    #[serde(rename = "S")]
    Spades,
    #[serde(rename = "NT")]
    NoTrump,
}

// --- Core structs ---

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Card {
    pub suit: Suit,
    pub rank: Rank,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Hand {
    pub cards: Vec<Card>,
}

/// Internally tagged union matching TS `Call = ContractBid | SpecialCall`.
/// Produces JSON like `{"type":"bid","level":1,"strain":"C"}` or `{"type":"pass"}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Call {
    #[serde(rename = "bid")]
    Bid { level: u8, strain: BidSuit },
    #[serde(rename = "pass")]
    Pass,
    #[serde(rename = "double")]
    Double,
    #[serde(rename = "redouble")]
    Redouble,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuctionEntry {
    pub seat: Seat,
    pub call: Call,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Auction {
    pub entries: Vec<AuctionEntry>,
    pub is_complete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contract {
    pub level: u8,
    pub strain: BidSuit,
    pub doubled: bool,
    pub redoubled: bool,
    pub declarer: Seat,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Deal {
    pub hands: HashMap<Seat, Hand>,
    pub dealer: Seat,
    pub vulnerability: Vulnerability,
}

/// Suit lengths: [Spades, Hearts, Diamonds, Clubs]
pub type SuitLength = [u8; 4];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DistributionPoints {
    pub shortness: u32,
    pub length: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HandEvaluation {
    pub hcp: u32,
    pub distribution: DistributionPoints,
    pub shape: SuitLength,
    #[serde(rename = "totalPoints")]
    pub total_points: u32,
    pub strategy: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayedCard {
    pub card: Card,
    pub seat: Seat,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trick {
    pub plays: Vec<PlayedCard>,
    pub trump_suit: Option<Suit>,
    pub winner: Option<Seat>,
}

// --- Constraint types (for deal generation over HTTP) ---

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatConstraint {
    pub seat: Seat,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_hcp: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_hcp: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balanced: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<HashMap<Suit, u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<HashMap<Suit, u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length_any: Option<HashMap<Suit, u8>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DealConstraints {
    pub seats: Vec<SeatConstraint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vulnerability: Option<Vulnerability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dealer: Option<Seat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_attempts: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DealGeneratorResult {
    pub deal: Deal,
    pub iterations: u32,
    pub relaxation_steps: u32,
}

// --- Future extensibility traits ---

/// Pluggable hand evaluation strategy (V1: HCP only, future: Bergen, Zar, LTC)
pub trait HandEvaluationStrategy: Send + Sync {
    fn name(&self) -> &str;
    fn evaluate(&self, hand: &Hand) -> HandEvaluation;
}

/// Play AI strategy (Phase 7: heuristic → DDS-assisted → convention-aware)
pub trait PlayStrategy: Send + Sync {
    fn suggest_play(
        &self,
        hand: &Hand,
        current_trick: &Trick,
        trump_suit: Option<Suit>,
        previous_tricks: &[Trick],
    ) -> Card;
}

/// Double dummy solver interface (V2: dds-bridge-sys FFI)
pub trait DoubleDummySolver: Send + Sync {
    fn solve(&self, deal: &Deal) -> Result<DDSolution, crate::error::EngineError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DDSolution {
    pub tricks: HashMap<Seat, HashMap<BidSuit, u32>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suit_serializes_to_single_char() {
        assert_eq!(serde_json::to_string(&Suit::Clubs).unwrap(), "\"C\"");
        assert_eq!(serde_json::to_string(&Suit::Diamonds).unwrap(), "\"D\"");
        assert_eq!(serde_json::to_string(&Suit::Hearts).unwrap(), "\"H\"");
        assert_eq!(serde_json::to_string(&Suit::Spades).unwrap(), "\"S\"");
    }

    #[test]
    fn rank_serializes_correctly() {
        assert_eq!(serde_json::to_string(&Rank::Two).unwrap(), "\"2\"");
        assert_eq!(serde_json::to_string(&Rank::Ten).unwrap(), "\"T\"");
        assert_eq!(serde_json::to_string(&Rank::Ace).unwrap(), "\"A\"");
    }

    #[test]
    fn seat_serializes_to_single_char() {
        assert_eq!(serde_json::to_string(&Seat::North).unwrap(), "\"N\"");
        assert_eq!(serde_json::to_string(&Seat::East).unwrap(), "\"E\"");
        assert_eq!(serde_json::to_string(&Seat::South).unwrap(), "\"S\"");
        assert_eq!(serde_json::to_string(&Seat::West).unwrap(), "\"W\"");
    }

    #[test]
    fn bid_suit_serializes_correctly() {
        assert_eq!(serde_json::to_string(&BidSuit::NoTrump).unwrap(), "\"NT\"");
        assert_eq!(serde_json::to_string(&BidSuit::Clubs).unwrap(), "\"C\"");
    }

    #[test]
    fn vulnerability_serializes_correctly() {
        assert_eq!(serde_json::to_string(&Vulnerability::None).unwrap(), "\"None\"");
        assert_eq!(serde_json::to_string(&Vulnerability::NorthSouth).unwrap(), "\"NS\"");
        assert_eq!(serde_json::to_string(&Vulnerability::EastWest).unwrap(), "\"EW\"");
        assert_eq!(serde_json::to_string(&Vulnerability::Both).unwrap(), "\"Both\"");
    }

    #[test]
    fn call_bid_internally_tagged() {
        let call = Call::Bid { level: 1, strain: BidSuit::Clubs };
        let json = serde_json::to_string(&call).unwrap();
        assert_eq!(json, r#"{"type":"bid","level":1,"strain":"C"}"#);
    }

    #[test]
    fn call_pass_serializes() {
        let call = Call::Pass;
        let json = serde_json::to_string(&call).unwrap();
        assert_eq!(json, r#"{"type":"pass"}"#);
    }

    #[test]
    fn call_double_serializes() {
        let json = serde_json::to_string(&Call::Double).unwrap();
        assert_eq!(json, r#"{"type":"double"}"#);
    }

    #[test]
    fn call_redouble_serializes() {
        let json = serde_json::to_string(&Call::Redouble).unwrap();
        assert_eq!(json, r#"{"type":"redouble"}"#);
    }

    #[test]
    fn call_roundtrip() {
        let calls = vec![
            Call::Bid { level: 3, strain: BidSuit::NoTrump },
            Call::Pass,
            Call::Double,
            Call::Redouble,
        ];
        for call in &calls {
            let json = serde_json::to_string(call).unwrap();
            let back: Call = serde_json::from_str(&json).unwrap();
            assert_eq!(&back, call);
        }
    }

    #[test]
    fn card_serializes() {
        let card = Card { suit: Suit::Spades, rank: Rank::Ace };
        let json = serde_json::to_string(&card).unwrap();
        assert_eq!(json, r#"{"suit":"S","rank":"A"}"#);
    }

    #[test]
    fn hashmap_seat_hand_serializes_with_string_keys() {
        let mut hands = HashMap::new();
        hands.insert(Seat::North, Hand { cards: vec![] });
        hands.insert(Seat::East, Hand { cards: vec![] });
        hands.insert(Seat::South, Hand { cards: vec![] });
        hands.insert(Seat::West, Hand { cards: vec![] });

        let json = serde_json::to_string(&hands).unwrap();
        // Verify keys are string seat codes, not numeric
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(v.get("N").is_some());
        assert!(v.get("E").is_some());
        assert!(v.get("S").is_some());
        assert!(v.get("W").is_some());
    }

    #[test]
    fn option_contract_none_is_null() {
        let opt: Option<Contract> = None;
        let json = serde_json::to_string(&opt).unwrap();
        assert_eq!(json, "null");
    }

    #[test]
    fn auction_camel_case() {
        let auction = Auction {
            entries: vec![],
            is_complete: false,
        };
        let json = serde_json::to_string(&auction).unwrap();
        assert!(json.contains("isComplete"));
        assert!(!json.contains("is_complete"));
    }

    #[test]
    fn deal_constraints_camel_case() {
        let dc = DealConstraints {
            seats: vec![],
            vulnerability: None,
            dealer: None,
            max_attempts: Some(5000),
            seed: None,
        };
        let json = serde_json::to_string(&dc).unwrap();
        assert!(json.contains("maxAttempts"));
    }

    #[test]
    fn suit_length_serializes_as_array() {
        let sl: SuitLength = [4, 3, 3, 3];
        let json = serde_json::to_string(&sl).unwrap();
        assert_eq!(json, "[4,3,3,3]");
    }

    #[test]
    fn hand_evaluation_total_points_camel_case() {
        let he = HandEvaluation {
            hcp: 10,
            distribution: DistributionPoints { shortness: 0, length: 0, total: 0 },
            shape: [4, 3, 3, 3],
            total_points: 10,
            strategy: "HCP".to_string(),
        };
        let json = serde_json::to_string(&he).unwrap();
        assert!(json.contains("totalPoints"));
    }

    #[test]
    fn deal_generator_result_camel_case() {
        let dgr = DealGeneratorResult {
            deal: Deal {
                hands: HashMap::new(),
                dealer: Seat::North,
                vulnerability: Vulnerability::None,
            },
            iterations: 1,
            relaxation_steps: 0,
        };
        let json = serde_json::to_string(&dgr).unwrap();
        assert!(json.contains("relaxationSteps"));
    }

    #[test]
    fn trick_camel_case() {
        let trick = Trick {
            plays: vec![],
            trump_suit: None,
            winner: None,
        };
        let json = serde_json::to_string(&trick).unwrap();
        assert!(json.contains("trumpSuit"));
    }

    #[test]
    fn deserialize_call_from_ts_format() {
        let bid_json = r#"{"type":"bid","level":2,"strain":"H"}"#;
        let call: Call = serde_json::from_str(bid_json).unwrap();
        assert_eq!(call, Call::Bid { level: 2, strain: BidSuit::Hearts });

        let pass_json = r#"{"type":"pass"}"#;
        let call: Call = serde_json::from_str(pass_json).unwrap();
        assert_eq!(call, Call::Pass);
    }

    #[test]
    fn seat_constraint_camel_case_roundtrip() {
        let json = r#"{"seat":"S","minHcp":12,"maxHcp":14,"balanced":true}"#;
        let sc: SeatConstraint = serde_json::from_str(json).unwrap();
        assert_eq!(sc.seat, Seat::South);
        assert_eq!(sc.min_hcp, Some(12));
        assert_eq!(sc.max_hcp, Some(14));
        assert_eq!(sc.balanced, Some(true));
    }
}
