//! Natural bidding inference provider parameterized by `SystemConfig`.
//!
//! Covers opening bids, passes, and basic responses using standard
//! bidding theory. System-dependent ranges (1NT opening, 1NT response)
//! come from `SystemConfig`.

use std::collections::HashMap;
use bridge_engine::types::{Auction, AuctionEntry, BidSuit, Call, Seat, Suit};
use bridge_engine::partner_seat;
use bridge_conventions::types::system_config::SystemConfig;

use super::types::{HandInference, InferenceProvider, SuitInference};

/// Default SAYC system config for natural inference.
/// Used when no explicit `SystemConfig` is provided.
fn default_sayc_nt_config() -> (u32, u32) {
    (15, 17) // SAYC 1NT opening range
}

fn default_sayc_1nt_response() -> (u32, u32) {
    (6, 10) // SAYC 1NT response after major
}

/// Natural bidding inference provider parameterized by system config.
pub struct NaturalInferenceProvider {
    /// 1NT opening HCP range from system config.
    nt_opening_min: u32,
    nt_opening_max: u32,
    /// 1NT response after major HCP range.
    nt_response_min: u32,
    nt_response_max: u32,
}

impl NaturalInferenceProvider {
    /// Create with explicit `SystemConfig`.
    pub fn new(config: &SystemConfig) -> Self {
        Self {
            nt_opening_min: config.nt_opening.min_hcp,
            nt_opening_max: config.nt_opening.max_hcp,
            nt_response_min: config.one_nt_response_after_major.min_hcp,
            nt_response_max: config.one_nt_response_after_major.max_hcp,
        }
    }

    /// Create with default SAYC parameters.
    pub fn default_sayc() -> Self {
        let (nt_min, nt_max) = default_sayc_nt_config();
        let (resp_min, resp_max) = default_sayc_1nt_response();
        Self {
            nt_opening_min: nt_min,
            nt_opening_max: nt_max,
            nt_response_min: resp_min,
            nt_response_max: resp_max,
        }
    }

    /// Infer from an opening bid (no prior contract bids).
    fn infer_from_opening(&self, level: u8, strain: BidSuit, seat: Seat) -> Option<HandInference> {
        if level == 1 {
            match strain {
                BidSuit::Clubs => Some(HandInference {
                    seat,
                    min_hcp: Some(12),
                    max_hcp: None,
                    is_balanced: None,
                    suits: [(Suit::Clubs, SuitInference { min_length: Some(3), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:1C-opening".to_string(),
                }),
                BidSuit::Diamonds => Some(HandInference {
                    seat,
                    min_hcp: Some(12),
                    max_hcp: None,
                    is_balanced: None,
                    suits: [(Suit::Diamonds, SuitInference { min_length: Some(4), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:1D-opening".to_string(),
                }),
                BidSuit::Hearts => Some(HandInference {
                    seat,
                    min_hcp: Some(12),
                    max_hcp: None,
                    is_balanced: None,
                    suits: [(Suit::Hearts, SuitInference { min_length: Some(5), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:1H-opening".to_string(),
                }),
                BidSuit::Spades => Some(HandInference {
                    seat,
                    min_hcp: Some(12),
                    max_hcp: None,
                    is_balanced: None,
                    suits: [(Suit::Spades, SuitInference { min_length: Some(5), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:1S-opening".to_string(),
                }),
                BidSuit::NoTrump => Some(HandInference {
                    seat,
                    min_hcp: Some(self.nt_opening_min),
                    max_hcp: Some(self.nt_opening_max),
                    is_balanced: Some(true),
                    suits: HashMap::new(),
                    source: "natural:1NT-opening".to_string(),
                }),
            }
        } else if level == 2 {
            match strain {
                BidSuit::Clubs => Some(HandInference {
                    seat,
                    min_hcp: Some(22),
                    max_hcp: None,
                    is_balanced: None,
                    suits: HashMap::new(),
                    source: "natural:2C-opening".to_string(),
                }),
                BidSuit::Hearts => Some(HandInference {
                    seat,
                    min_hcp: Some(5),
                    max_hcp: Some(11),
                    is_balanced: None,
                    suits: [(Suit::Hearts, SuitInference { min_length: Some(6), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:2H-opening".to_string(),
                }),
                BidSuit::Spades => Some(HandInference {
                    seat,
                    min_hcp: Some(5),
                    max_hcp: Some(11),
                    is_balanced: None,
                    suits: [(Suit::Spades, SuitInference { min_length: Some(6), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:2S-opening".to_string(),
                }),
                BidSuit::Diamonds => Some(HandInference {
                    seat,
                    min_hcp: Some(5),
                    max_hcp: Some(11),
                    is_balanced: None,
                    suits: [(Suit::Diamonds, SuitInference { min_length: Some(6), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:weak-2D-opening".to_string(),
                }),
                BidSuit::NoTrump => Some(HandInference {
                    seat,
                    min_hcp: Some(20),
                    max_hcp: Some(21),
                    is_balanced: Some(true),
                    suits: HashMap::new(),
                    source: "natural:2NT-opening".to_string(),
                }),
            }
        } else {
            None
        }
    }

    /// Infer from a pass.
    fn infer_from_pass(&self, auction_before: &Auction, seat: Seat) -> Option<HandInference> {
        let has_contract_bid = auction_before.entries.iter().any(|e| matches!(e.call, Call::Bid { .. }));

        if has_contract_bid {
            // Pass over an opening/bid: often 0-11 HCP without a suitable call
            return Some(HandInference {
                seat,
                min_hcp: None,
                max_hcp: Some(11),
                is_balanced: None,
                suits: HashMap::new(),
                source: "natural:pass-over-bid".to_string(),
            });
        }

        // Pass in first or second seat with no bids: less than 12 HCP
        let pass_count = auction_before.entries.iter()
            .filter(|e| matches!(e.call, Call::Pass))
            .count();

        if pass_count < 2 {
            return Some(HandInference {
                seat,
                min_hcp: None,
                max_hcp: Some(11),
                is_balanced: None,
                suits: HashMap::new(),
                source: "natural:pass-no-opening".to_string(),
            });
        }

        None
    }

    /// Infer from a response to a prior bid.
    fn infer_from_response(
        &self,
        level: u8,
        strain: BidSuit,
        auction_before: &Auction,
        seat: Seat,
    ) -> Option<HandInference> {
        // 1NT response: system-dependent range
        if level == 1 && strain == BidSuit::NoTrump {
            return Some(HandInference {
                seat,
                min_hcp: Some(self.nt_response_min),
                max_hcp: Some(self.nt_response_max),
                is_balanced: None,
                suits: HashMap::new(),
                source: "natural:1NT-response".to_string(),
            });
        }

        // New suit at 1-level: 6+ HCP, 4+ in suit
        if level == 1 {
            if let Some(suit) = bid_suit_to_suit(strain) {
                return Some(HandInference {
                    seat,
                    min_hcp: Some(6),
                    max_hcp: None,
                    is_balanced: None,
                    suits: [(suit, SuitInference { min_length: Some(4), max_length: None })]
                        .into_iter().collect(),
                    source: "natural:1-level-new-suit".to_string(),
                });
            }
        }

        // Simple raise (2-level of partner's suit): 6-10 HCP, 3+ support
        if level == 2 && strain != BidSuit::NoTrump {
            if let Some(partner_bid) = find_partner_last_bid(auction_before, seat) {
                if partner_bid.1 == strain {
                    if let Some(suit) = bid_suit_to_suit(strain) {
                        return Some(HandInference {
                            seat,
                            min_hcp: Some(6),
                            max_hcp: Some(10),
                            is_balanced: None,
                            suits: [(suit, SuitInference { min_length: Some(3), max_length: None })]
                                .into_iter().collect(),
                            source: "natural:simple-raise".to_string(),
                        });
                    }
                }
            }
        }

        None
    }
}

impl InferenceProvider for NaturalInferenceProvider {
    fn id(&self) -> &str {
        "natural"
    }

    fn name(&self) -> &str {
        "Natural Bidding Theory"
    }

    fn infer_from_bid(
        &self,
        entry: &AuctionEntry,
        auction_before: &Auction,
        seat: Seat,
    ) -> Option<HandInference> {
        match &entry.call {
            Call::Pass => self.infer_from_pass(auction_before, seat),
            Call::Bid { level, strain } => {
                let has_contract_bid = auction_before.entries.iter()
                    .any(|e| matches!(e.call, Call::Bid { .. }));

                if !has_contract_bid {
                    self.infer_from_opening(*level, *strain, seat)
                } else {
                    self.infer_from_response(*level, *strain, auction_before, seat)
                }
            }
            Call::Double | Call::Redouble => None,
        }
    }
}

/// Convert BidSuit to Suit (excludes NoTrump).
fn bid_suit_to_suit(strain: BidSuit) -> Option<Suit> {
    match strain {
        BidSuit::Clubs => Some(Suit::Clubs),
        BidSuit::Diamonds => Some(Suit::Diamonds),
        BidSuit::Hearts => Some(Suit::Hearts),
        BidSuit::Spades => Some(Suit::Spades),
        BidSuit::NoTrump => None,
    }
}

/// Find the last contract bid made by seat's partner. Returns (level, strain).
fn find_partner_last_bid(auction: &Auction, seat: Seat) -> Option<(u8, BidSuit)> {
    let partner = partner_seat(seat);
    for entry in auction.entries.iter().rev() {
        if entry.seat == partner {
            if let Call::Bid { level, strain } = &entry.call {
                return Some((*level, *strain));
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_auction() -> Auction {
        Auction { entries: vec![], is_complete: false }
    }

    fn make_entry(seat: Seat, call: Call) -> AuctionEntry {
        AuctionEntry { seat, call }
    }

    fn provider() -> NaturalInferenceProvider {
        NaturalInferenceProvider::default_sayc()
    }

    #[test]
    fn opening_1nt_15_17_balanced() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::NoTrump });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(15));
        assert_eq!(result.max_hcp, Some(17));
        assert_eq!(result.is_balanced, Some(true));
        assert!(result.source.contains("1NT"));
    }

    #[test]
    fn opening_1h_12_plus_5_hearts() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.suits[&Suit::Hearts].min_length, Some(5));
    }

    #[test]
    fn opening_1s_12_plus_5_spades() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Spades });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.suits[&Suit::Spades].min_length, Some(5));
    }

    #[test]
    fn opening_1c_12_plus_3_clubs() {
        let p = provider();
        let entry = make_entry(Seat::South, Call::Bid { level: 1, strain: BidSuit::Clubs });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::South).unwrap();

        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.suits[&Suit::Clubs].min_length, Some(3));
    }

    #[test]
    fn opening_1d_12_plus_4_diamonds() {
        let p = provider();
        let entry = make_entry(Seat::West, Call::Bid { level: 1, strain: BidSuit::Diamonds });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::West).unwrap();

        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.suits[&Suit::Diamonds].min_length, Some(4));
    }

    #[test]
    fn opening_2c_22_plus() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 2, strain: BidSuit::Clubs });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(22));
    }

    #[test]
    fn opening_2nt_20_21_balanced() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 2, strain: BidSuit::NoTrump });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(20));
        assert_eq!(result.max_hcp, Some(21));
        assert_eq!(result.is_balanced, Some(true));
    }

    #[test]
    fn opening_2h_weak_two() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Bid { level: 2, strain: BidSuit::Hearts });
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.min_hcp, Some(5));
        assert_eq!(result.max_hcp, Some(11));
        assert_eq!(result.suits[&Suit::Hearts].min_length, Some(6));
    }

    #[test]
    fn pass_first_seat_less_than_12() {
        let p = provider();
        let entry = make_entry(Seat::North, Call::Pass);
        let result = p.infer_from_bid(&entry, &empty_auction(), Seat::North).unwrap();

        assert_eq!(result.max_hcp, Some(11));
    }

    #[test]
    fn pass_over_opening_bid() {
        let p = provider();
        let auction_before = Auction {
            entries: vec![make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts })],
            is_complete: false,
        };
        let entry = make_entry(Seat::East, Call::Pass);
        let result = p.infer_from_bid(&entry, &auction_before, Seat::East).unwrap();

        assert_eq!(result.max_hcp, Some(11));
    }

    #[test]
    fn response_1nt_6_10() {
        let p = provider();
        let auction_before = Auction {
            entries: vec![
                make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts }),
                make_entry(Seat::East, Call::Pass),
            ],
            is_complete: false,
        };
        let entry = make_entry(Seat::South, Call::Bid { level: 1, strain: BidSuit::NoTrump });
        let result = p.infer_from_bid(&entry, &auction_before, Seat::South).unwrap();

        assert_eq!(result.min_hcp, Some(6));
        assert_eq!(result.max_hcp, Some(10));
    }

    #[test]
    fn response_1s_to_1h() {
        let p = provider();
        let auction_before = Auction {
            entries: vec![
                make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts }),
                make_entry(Seat::East, Call::Pass),
            ],
            is_complete: false,
        };
        let entry = make_entry(Seat::South, Call::Bid { level: 1, strain: BidSuit::Spades });
        let result = p.infer_from_bid(&entry, &auction_before, Seat::South).unwrap();

        assert_eq!(result.min_hcp, Some(6));
        assert_eq!(result.suits[&Suit::Spades].min_length, Some(4));
    }

    #[test]
    fn simple_raise_2h_over_partner_1h() {
        let p = provider();
        let auction_before = Auction {
            entries: vec![
                make_entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts }),
                make_entry(Seat::East, Call::Pass),
            ],
            is_complete: false,
        };
        let entry = make_entry(Seat::South, Call::Bid { level: 2, strain: BidSuit::Hearts });
        let result = p.infer_from_bid(&entry, &auction_before, Seat::South).unwrap();

        assert_eq!(result.min_hcp, Some(6));
        assert_eq!(result.max_hcp, Some(10));
        assert_eq!(result.suits[&Suit::Hearts].min_length, Some(3));
    }

    #[test]
    fn double_returns_none() {
        let p = provider();
        let entry = make_entry(Seat::East, Call::Double);
        assert!(p.infer_from_bid(&entry, &empty_auction(), Seat::East).is_none());
    }

    #[test]
    fn redouble_returns_none() {
        let p = provider();
        let entry = make_entry(Seat::East, Call::Redouble);
        assert!(p.infer_from_bid(&entry, &empty_auction(), Seat::East).is_none());
    }
}
