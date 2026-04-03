//! Practice focus — derives module ordering and initial auction for targeted practice.

use bridge_engine::types::{Auction, AuctionEntry, BidSuit, Call, Deal, DealConstraints, Seat, Suit};
use crate::types::{PracticeFocus, PracticeRole};

/// Derive practice focus — which modules are target, prerequisites, follow-up, background.
///
/// Uses member ordering as a proxy for module dependencies.
pub fn derive_practice_focus(
    bundle_member_ids: &[String],
    target_module_id: &str,
    base_module_ids: &[&str],
) -> PracticeFocus {
    let target_pos = bundle_member_ids
        .iter()
        .position(|id| id == target_module_id);

    let target = vec![target_module_id.to_string()];

    // natural-bids is always a prerequisite (unless it IS the target)
    let mut prerequisites: Vec<String> = Vec::new();
    if target_module_id != "natural-bids" {
        prerequisites.push("natural-bids".to_string());
    }

    let (follow_up, background) = match target_pos {
        Some(pos) => {
            let follow = bundle_member_ids[pos + 1..].to_vec();
            let mut bg: Vec<String> = bundle_member_ids[..pos].to_vec();
            // Add remaining base modules not already included
            for base_id in base_module_ids {
                let base_str = base_id.to_string();
                if base_str != target_module_id
                    && !prerequisites.contains(&base_str)
                    && !bg.contains(&base_str)
                    && !follow.contains(&base_str)
                {
                    bg.push(base_str);
                }
            }
            (follow, bg)
        }
        None => {
            // target not in bundle members — everything else is background
            let bg: Vec<String> = bundle_member_ids
                .iter()
                .filter(|id| id.as_str() != target_module_id)
                .cloned()
                .collect();
            (Vec::new(), bg)
        }
    };

    PracticeFocus {
        target_module_ids: target,
        prerequisite_module_ids: prerequisites,
        follow_up_module_ids: follow_up,
        background_module_ids: background,
    }
}

/// Derive an initial auction for the practice target.
///
/// Recognition rules applied in order — first match wins:
/// 1. If user is opener: return None (user opens)
/// 2. If no deal constraints: return None
/// 3. If balanced + HCP overlaps 15–17: return 1NT
/// 4. If 5+ hearts: return 1H
/// 5. If 5+ spades: return 1S
/// 6. Otherwise: return None
///
/// // MAINTENANCE: This function uses hardcoded bundle-family recognition.
/// // When adding a new bundle type (e.g., weak twos, DONT), update the
/// // match rules here or the new bundle will silently get no initial auction.
pub fn derive_initial_auction(
    resolved_role: PracticeRole,
    dealer: Seat,
    deal_constraints: Option<&DealConstraints>,
    deal: Option<&Deal>,
) -> Option<Auction> {
    // Rule 1: opener makes the first bid
    if resolved_role == PracticeRole::Opener {
        return None;
    }

    // Rule 2: no constraints = no inference possible
    let constraints = deal_constraints?;

    // Check seat constraints for opener characteristics
    for sc in &constraints.seats {
        // Rule 3: balanced hand with 15-17 HCP range → 1NT opening
        if sc.balanced == Some(true) {
            let min_hcp = sc.min_hcp.unwrap_or(0);
            let max_hcp = sc.max_hcp.unwrap_or(40);
            if min_hcp <= 17 && max_hcp >= 15 {
                return Some(Auction {
                    entries: vec![AuctionEntry {
                        seat: dealer,
                        call: Call::Bid {
                            level: 1,
                            strain: BidSuit::NoTrump,
                        },
                    }],
                    is_complete: false,
                });
            }
        }

        // Rule 4: 5+ hearts → 1H
        if let Some(ref min_lengths) = sc.min_length {
            if let Some(&hearts_min) = min_lengths.get(&Suit::Hearts) {
                if hearts_min >= 5 {
                    return Some(Auction {
                        entries: vec![AuctionEntry {
                            seat: dealer,
                            call: Call::Bid {
                                level: 1,
                                strain: BidSuit::Hearts,
                            },
                        }],
                        is_complete: false,
                    });
                }
            }

            // Rule 5: 5+ spades → 1S
            if let Some(&spades_min) = min_lengths.get(&Suit::Spades) {
                if spades_min >= 5 {
                    return Some(Auction {
                        entries: vec![AuctionEntry {
                            seat: dealer,
                            call: Call::Bid {
                                level: 1,
                                strain: BidSuit::Spades,
                            },
                        }],
                        is_complete: false,
                    });
                }
            }
        }

        // Rule 4b/5b: min_length_any — OR semantics (5+ in any listed major)
        if let Some(ref min_any) = sc.min_length_any {
            let has_major_any = min_any.get(&Suit::Hearts).map_or(false, |&m| m >= 5)
                || min_any.get(&Suit::Spades).map_or(false, |&m| m >= 5);
            if has_major_any {
                // Use actual deal to pick the correct major
                if let Some(deal) = deal {
                    if let Some(hand) = deal.hands.get(&dealer) {
                        let hearts = hand.cards.iter().filter(|c| c.suit == Suit::Hearts).count();
                        let spades = hand.cards.iter().filter(|c| c.suit == Suit::Spades).count();
                        let strain = if spades > hearts { BidSuit::Spades } else { BidSuit::Hearts };
                        return Some(Auction {
                            entries: vec![AuctionEntry {
                                seat: dealer,
                                call: Call::Bid { level: 1, strain },
                            }],
                            is_complete: false,
                        });
                    }
                }
                // Fallback without deal: pick hearts
                return Some(Auction {
                    entries: vec![AuctionEntry {
                        seat: dealer,
                        call: Call::Bid { level: 1, strain: BidSuit::Hearts },
                    }],
                    is_complete: false,
                });
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::SeatConstraint;
    use std::collections::HashMap;

    // ── derive_practice_focus tests ─────────────────────────────────

    #[test]
    fn focus_target_in_middle() {
        let members = vec![
            "stayman".to_string(),
            "transfers".to_string(),
            "quantitative".to_string(),
        ];
        let focus = derive_practice_focus(&members, "transfers", &["natural-bids", "blackwood"]);

        assert_eq!(focus.target_module_ids, vec!["transfers"]);
        assert_eq!(focus.prerequisite_module_ids, vec!["natural-bids"]);
        assert_eq!(focus.follow_up_module_ids, vec!["quantitative"]);
        // "stayman" is before target, "blackwood" is a base module not elsewhere
        assert!(focus.background_module_ids.contains(&"stayman".to_string()));
        assert!(focus.background_module_ids.contains(&"blackwood".to_string()));
    }

    #[test]
    fn focus_target_is_first() {
        let members = vec![
            "stayman".to_string(),
            "transfers".to_string(),
        ];
        let focus = derive_practice_focus(&members, "stayman", &["natural-bids"]);

        assert_eq!(focus.target_module_ids, vec!["stayman"]);
        assert_eq!(focus.prerequisite_module_ids, vec!["natural-bids"]);
        assert!(focus.background_module_ids.is_empty());
        assert_eq!(focus.follow_up_module_ids, vec!["transfers"]);
    }

    #[test]
    fn focus_target_is_natural_bids() {
        let members = vec!["natural-bids".to_string(), "stayman".to_string()];
        let focus = derive_practice_focus(&members, "natural-bids", &["natural-bids"]);

        assert_eq!(focus.target_module_ids, vec!["natural-bids"]);
        assert!(focus.prerequisite_module_ids.is_empty());
        assert_eq!(focus.follow_up_module_ids, vec!["stayman"]);
    }

    #[test]
    fn focus_target_not_in_bundle() {
        let members = vec!["stayman".to_string(), "transfers".to_string()];
        let focus = derive_practice_focus(&members, "unknown", &["natural-bids"]);

        assert_eq!(focus.target_module_ids, vec!["unknown"]);
        assert_eq!(focus.prerequisite_module_ids, vec!["natural-bids"]);
        assert!(focus.follow_up_module_ids.is_empty());
        assert_eq!(focus.background_module_ids, vec!["stayman", "transfers"]);
    }

    // ── derive_initial_auction tests ────────────────────────────────

    #[test]
    fn opener_gets_no_initial_auction() {
        let result = derive_initial_auction(PracticeRole::Opener, Seat::North, None, None);
        assert!(result.is_none());
    }

    #[test]
    fn no_constraints_returns_none() {
        let result = derive_initial_auction(PracticeRole::Responder, Seat::North, None, None);
        assert!(result.is_none());
    }

    #[test]
    fn balanced_15_17_returns_1nt() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(15),
                max_hcp: Some(17),
                balanced: Some(true),
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            None,
        );
        let auction = result.expect("should produce 1NT auction");
        assert_eq!(auction.entries.len(), 1);
        assert_eq!(auction.entries[0].seat, Seat::North);
        assert_eq!(
            auction.entries[0].call,
            Call::Bid { level: 1, strain: BidSuit::NoTrump }
        );
        assert!(!auction.is_complete);
    }

    #[test]
    fn five_hearts_returns_1h() {
        let mut min_length = HashMap::new();
        min_length.insert(Suit::Hearts, 5);

        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: Some(21),
                balanced: None,
                min_length: Some(min_length),
                max_length: None,
                min_length_any: None,
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            None,
        );
        let auction = result.expect("should produce 1H auction");
        assert_eq!(
            auction.entries[0].call,
            Call::Bid { level: 1, strain: BidSuit::Hearts }
        );
    }

    #[test]
    fn five_spades_returns_1s() {
        let mut min_length = HashMap::new();
        min_length.insert(Suit::Spades, 5);

        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: Some(21),
                balanced: None,
                min_length: Some(min_length),
                max_length: None,
                min_length_any: None,
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            None,
        );
        let auction = result.expect("should produce 1S auction");
        assert_eq!(
            auction.entries[0].call,
            Call::Bid { level: 1, strain: BidSuit::Spades }
        );
    }

    #[test]
    fn min_length_any_with_deal_picks_longer_major() {
        use bridge_engine::types::{Card, Deal, Hand, Rank, Vulnerability};

        let mut min_any = HashMap::new();
        min_any.insert(Suit::Hearts, 5);
        min_any.insert(Suit::Spades, 5);

        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: Some(21),
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: Some(min_any),
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        // North has 5 spades and 3 hearts → should pick 1S
        let mut hands = HashMap::new();
        hands.insert(Seat::North, Hand {
            cards: vec![
                Card { suit: Suit::Spades, rank: Rank::Ace },
                Card { suit: Suit::Spades, rank: Rank::King },
                Card { suit: Suit::Spades, rank: Rank::Queen },
                Card { suit: Suit::Spades, rank: Rank::Jack },
                Card { suit: Suit::Spades, rank: Rank::Ten },
                Card { suit: Suit::Hearts, rank: Rank::Ace },
                Card { suit: Suit::Hearts, rank: Rank::King },
                Card { suit: Suit::Hearts, rank: Rank::Queen },
                Card { suit: Suit::Diamonds, rank: Rank::Ace },
                Card { suit: Suit::Diamonds, rank: Rank::King },
                Card { suit: Suit::Clubs, rank: Rank::Ace },
                Card { suit: Suit::Clubs, rank: Rank::King },
                Card { suit: Suit::Clubs, rank: Rank::Queen },
            ],
        });
        let deal = Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            Some(&deal),
        );
        let auction = result.expect("should produce 1S auction");
        assert_eq!(
            auction.entries[0].call,
            Call::Bid { level: 1, strain: BidSuit::Spades }
        );
    }

    #[test]
    fn min_length_any_without_deal_defaults_to_hearts() {
        let mut min_any = HashMap::new();
        min_any.insert(Suit::Hearts, 5);
        min_any.insert(Suit::Spades, 5);

        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: Some(21),
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: Some(min_any),
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            None,
        );
        let auction = result.expect("should produce 1H auction (fallback)");
        assert_eq!(
            auction.entries[0].call,
            Call::Bid { level: 1, strain: BidSuit::Hearts }
        );
    }

    #[test]
    fn no_matching_pattern_returns_none() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: Some(21),
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };

        let result = derive_initial_auction(
            PracticeRole::Responder,
            Seat::North,
            Some(&constraints),
            None,
        );
        assert!(result.is_none());
    }
}
