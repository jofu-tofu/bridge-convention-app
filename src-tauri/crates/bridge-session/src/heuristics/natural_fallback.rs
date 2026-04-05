//! Natural fallback bidding strategy.
//!
//! Convention-independent heuristic: with 6+ HCP and a 5+ card suit, bid the
//! cheapest legal level in that suit, capped by HCP-based max level.
//!
//! Mirrors TS `naturalFallbackStrategy` from `session/heuristics/natural-fallback.ts`.

use bridge_engine::{is_legal_call, BidSuit, Call};

use super::{BidResult, BiddingContext, BiddingStrategy};

/// Suit order: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
/// Maps shape index to BidSuit for contract bids.
const SHAPE_INDEX_TO_BID_SUIT: [BidSuit; 4] = [
    BidSuit::Spades,
    BidSuit::Hearts,
    BidSuit::Diamonds,
    BidSuit::Clubs,
];

/// Suit names for explanations, matching SUIT_ORDER.
const SUIT_NAMES: [&str; 4] = ["Spades", "Hearts", "Diamonds", "Clubs"];

/// HCP-based maximum bid level to prevent runaway escalation.
/// This is a simple fallback -- real conventions handle competitive judgment.
fn max_level_for_hcp(hcp: u32) -> u8 {
    if hcp >= 20 {
        5
    } else if hcp >= 16 {
        4
    } else if hcp >= 12 {
        3
    } else {
        2
    }
}

/// Natural fallback strategy: bids the cheapest legal suit bid with a 5+ card
/// suit and 6+ HCP, capped by strength.
pub struct NaturalFallbackStrategy;

impl BiddingStrategy for NaturalFallbackStrategy {
    fn id(&self) -> &str {
        "natural-fallback"
    }

    fn name(&self) -> &str {
        "Natural Fallback"
    }

    fn suggest_bid(&self, context: &BiddingContext) -> Option<BidResult> {
        let eval = &context.evaluation;

        if eval.hcp < 6 {
            return None;
        }

        // Find longest 5+ card suit; ties go to highest-ranking (lowest shape index)
        let mut best_index: Option<usize> = None;
        let mut best_length: u8 = 4; // minimum 5 to qualify

        for i in 0..4 {
            let length = eval.shape[i];
            if length > best_length {
                best_length = length;
                best_index = Some(i);
            }
        }

        let best_index = best_index?;
        let strain = SHAPE_INDEX_TO_BID_SUIT[best_index];
        let max_level = max_level_for_hcp(eval.hcp);

        // Find cheapest legal level for this suit, capped by HCP strength
        for level in 1..=max_level {
            let call = Call::Bid { level, strain };
            if is_legal_call(&context.auction, &call, context.seat) {
                return Some(BidResult {
                    call,
                    rule_name: None,
                    explanation: format!(
                        "Natural bid with {}-card {} suit",
                        best_length, SUIT_NAMES[best_index]
                    ),
                    ..Default::default()
                });
            }
        }

        None
    }

    fn as_any(&self) -> &dyn std::any::Any { self }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{
        Auction, AuctionEntry, Card, Hand, HandEvaluation,
        Rank, Seat, Suit,
    };

    fn make_hand(specs: &[(&str, &str)]) -> Hand {
        let cards: Vec<Card> = specs
            .iter()
            .map(|(s, r)| Card {
                suit: match *s {
                    "S" => Suit::Spades,
                    "H" => Suit::Hearts,
                    "D" => Suit::Diamonds,
                    "C" => Suit::Clubs,
                    _ => panic!("Invalid suit"),
                },
                rank: match *r {
                    "2" => Rank::Two,
                    "3" => Rank::Three,
                    "4" => Rank::Four,
                    "5" => Rank::Five,
                    "6" => Rank::Six,
                    "7" => Rank::Seven,
                    "8" => Rank::Eight,
                    "9" => Rank::Nine,
                    "T" => Rank::Ten,
                    "J" => Rank::Jack,
                    "Q" => Rank::Queen,
                    "K" => Rank::King,
                    "A" => Rank::Ace,
                    _ => panic!("Invalid rank"),
                },
            })
            .collect();
        Hand { cards }
    }

    fn make_context(hcp: u32, shape: [u8; 4], hand: Hand) -> BiddingContext {
        let distribution = bridge_engine::calculate_distribution_points(&shape);
        BiddingContext {
            hand,
            auction: Auction {
                entries: vec![],
                is_complete: false,
            },
            seat: Seat::South,
            evaluation: HandEvaluation {
                hcp,
                distribution,
                shape,

                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: None,
        }
    }

    #[test]
    fn declines_with_low_hcp() {
        let hand = make_hand(&[
            ("S", "2"),
            ("S", "3"),
            ("S", "4"),
            ("S", "5"),
            ("S", "6"),
            ("H", "2"),
            ("H", "3"),
            ("H", "4"),
            ("D", "2"),
            ("D", "3"),
            ("C", "2"),
            ("C", "3"),
            ("C", "4"),
        ]);
        let ctx = make_context(3, [5, 3, 2, 3], hand);
        let strategy = NaturalFallbackStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn declines_without_5_card_suit() {
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "Q"),
            ("S", "J"),
            ("H", "A"),
            ("H", "K"),
            ("H", "Q"),
            ("D", "A"),
            ("D", "K"),
            ("D", "Q"),
            ("C", "A"),
            ("C", "K"),
            ("C", "Q"),
        ]);
        let ctx = make_context(37, [4, 3, 3, 3], hand);
        let strategy = NaturalFallbackStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn bids_5_card_suit_at_cheapest_level() {
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "Q"),
            ("S", "J"),
            ("S", "T"),
            ("H", "A"),
            ("H", "K"),
            ("H", "Q"),
            ("D", "A"),
            ("D", "K"),
            ("C", "2"),
            ("C", "3"),
            ("C", "4"),
        ]);
        let ctx = make_context(27, [5, 3, 2, 3], hand);
        let strategy = NaturalFallbackStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(
            result.call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Spades
            }
        );
        assert!(result.explanation.contains("5-card"));
        assert!(result.explanation.contains("Spades"));
    }

    #[test]
    fn respects_hcp_level_cap() {
        // 8 HCP => max level 2. If 1S is taken, should try 2S.
        let hand = make_hand(&[
            ("S", "K"),
            ("S", "Q"),
            ("S", "7"),
            ("S", "6"),
            ("S", "5"),
            ("H", "2"),
            ("H", "3"),
            ("H", "4"),
            ("D", "2"),
            ("D", "3"),
            ("C", "2"),
            ("C", "3"),
            ("C", "4"),
        ]);
        let mut ctx = make_context(5, [5, 3, 2, 3], hand);
        // Make it so 1S is not available: opponent bid 1NT
        ctx.evaluation.hcp = 8;
        ctx.auction = Auction {
            entries: vec![AuctionEntry {
                seat: Seat::West,
                call: Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump,
                },
            }],
            is_complete: false,
        };
        let strategy = NaturalFallbackStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(
            result.call,
            Call::Bid {
                level: 2,
                strain: BidSuit::Spades
            }
        );
    }

    #[test]
    fn returns_none_when_level_capped_out() {
        // 7 HCP => max level 2. If auction is already at 2S+, decline.
        let hand = make_hand(&[
            ("S", "Q"),
            ("S", "J"),
            ("S", "7"),
            ("S", "6"),
            ("S", "5"),
            ("H", "2"),
            ("H", "3"),
            ("H", "4"),
            ("D", "2"),
            ("D", "3"),
            ("C", "2"),
            ("C", "3"),
            ("C", "4"),
        ]);
        let mut ctx = make_context(7, [5, 3, 2, 3], hand);
        ctx.auction = Auction {
            entries: vec![AuctionEntry {
                seat: Seat::West,
                call: Call::Bid {
                    level: 2,
                    strain: BidSuit::Spades,
                },
            }],
            is_complete: false,
        };
        let strategy = NaturalFallbackStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn prefers_longer_suit() {
        // 6-card hearts vs 5-card spades: should bid hearts
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "Q"),
            ("S", "J"),
            ("S", "T"),
            ("H", "A"),
            ("H", "K"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "T"),
            ("H", "9"),
            ("D", "2"),
            ("C", "2"),
        ]);
        let ctx = make_context(22, [5, 6, 1, 1], hand);
        let strategy = NaturalFallbackStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(
            result.call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Hearts
            }
        );
        assert!(result.explanation.contains("6-card"));
    }

    #[test]
    fn ties_go_to_higher_ranking_suit() {
        // Both spades and hearts are 5 cards: spades wins (lower shape index)
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "Q"),
            ("S", "J"),
            ("S", "T"),
            ("H", "A"),
            ("H", "K"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "T"),
            ("D", "2"),
            ("D", "3"),
            ("C", "2"),
        ]);
        let ctx = make_context(24, [5, 5, 2, 1], hand);
        let strategy = NaturalFallbackStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        // Tie-break: first found with length > best_length, so spades (index 0) checked first.
        // But since both are 5, spades is found first and sets best_length to 5.
        // Hearts at index 1 has length 5 which is NOT > 5, so spades wins.
        assert_eq!(
            result.call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Spades
            }
        );
    }
}
