//! Viewport builder functions — constructs player-safe viewport DTOs from engine state.
//!
//! This is the SINGLE module that enforces the information boundary. Both the UI
//! (via WASM) and CLI harness call these same functions.
//!
//! Type definitions live in `viewport_types.rs`. This file contains only the
//! builder functions and shared helpers.
//!
//! Ported from TS `src/session/build-viewport.ts`.

use std::collections::{HashMap, HashSet};

use bridge_engine::types::{Auction, BidSuit, Call, Deal, Hand, Seat};
use bridge_engine::{evaluate_hand_hcp, is_balanced};

use super::viewport_types::{
    AuctionEntryView, BidHistoryEntryView, BiddingViewport, BuildBiddingViewportInput,
    BuildDeclarerPromptViewportInput, BuildExplanationViewportInput, BuildPlayingViewportInput,
    DeclarerPromptViewport, ExplanationViewport, HandEvaluationView, PlayingViewport,
};

// ── Format helpers ────────────────────────────────────────────────

/// Format a Call for display: "1\u{2663}", "1NT", "Pass", "Dbl", "Rdbl", "2\u{2665}", etc.
/// Uses Unicode suit symbols to match the TS `formatCall` output.
pub fn format_call(call: &Call) -> String {
    match call {
        Call::Pass => "Pass".to_string(),
        Call::Double => "Dbl".to_string(),
        Call::Redouble => "Rdbl".to_string(),
        Call::Bid { level, strain } => {
            let suit_str = match strain {
                BidSuit::Clubs => "\u{2663}",
                BidSuit::Diamonds => "\u{2666}",
                BidSuit::Hearts => "\u{2665}",
                BidSuit::Spades => "\u{2660}",
                BidSuit::NoTrump => "NT",
            };
            format!("{}{}", level, suit_str)
        }
    }
}

// ── Shared helpers ────────────────────────────────────────────────

/// Build viewport-safe auction entries from raw auction + optional bid history.
pub fn build_auction_entries(
    auction: &Auction,
    bid_history: &[BidHistoryEntryView],
) -> Vec<AuctionEntryView> {
    auction
        .entries
        .iter()
        .enumerate()
        .map(|(i, entry)| {
            let history_entry = bid_history.get(i);
            AuctionEntryView {
                seat: entry.seat,
                call: entry.call.clone(),
                call_display: format_call(&entry.call),
                alert_label: history_entry.and_then(|h| h.alert_label.clone()),
                annotation_type: history_entry.and_then(|h| h.annotation_type),
                meaning: history_entry.and_then(|h| h.meaning.clone()),
            }
        })
        .collect()
}

/// Filter hands through face_up_seats, returning only visible ones.
pub fn filter_visible_hands(deal: &Deal, face_up_seats: &HashSet<Seat>) -> HashMap<Seat, Hand> {
    let mut visible = HashMap::new();
    for &seat in face_up_seats {
        if let Some(hand) = deal.hands.get(&seat) {
            visible.insert(seat, hand.clone());
        }
    }
    visible
}

// ── Builder functions ─────────────────────────────────────────────

/// Build a BiddingViewport from engine state.
///
/// This is the information boundary. The returned viewport contains
/// ONLY what a player in `user_seat` can legitimately see.
pub fn build_bidding_viewport(input: BuildBiddingViewportInput) -> BiddingViewport {
    let hand = input
        .deal
        .hands
        .get(&input.user_seat)
        .cloned()
        .unwrap_or_else(|| Hand { cards: vec![] });

    let eval = evaluate_hand_hcp(&hand);
    let hand_evaluation = HandEvaluationView {
        hcp: eval.hcp,
        shape: eval.shape,
        is_balanced: is_balanced(&eval.shape),
        distribution_points: eval.distribution,
    };

    let hand_summary = format!(
        "{}-{}-{}-{}, {} HCP",
        eval.shape[0], eval.shape[1], eval.shape[2], eval.shape[3], eval.hcp
    );

    let visible_hands = filter_visible_hands(input.deal, input.face_up_seats);
    let auction_entries = build_auction_entries(input.auction, input.bid_history);

    BiddingViewport {
        seat: input.user_seat,
        convention_name: input.convention_name,
        hand,
        hand_evaluation,
        hand_summary,
        visible_hands,
        auction_entries,
        dealer: input.deal.dealer,
        vulnerability: input.deal.vulnerability,
        legal_calls: input.legal_calls.to_vec(),
        is_user_turn: input.is_user_turn,
        current_bidder: input.current_bidder,
        practice_mode: input.practice_mode,
        bid_context: input.bid_context,
        bidding_options: input.bidding_options,
    }
}

/// Build a DeclarerPromptViewport from engine state.
///
/// Filters hands through face_up_seats so the component never sees
/// cards the player shouldn't know about.
pub fn build_declarer_prompt_viewport(
    input: BuildDeclarerPromptViewportInput,
) -> DeclarerPromptViewport {
    DeclarerPromptViewport {
        user_seat: input.user_seat,
        visible_hands: filter_visible_hands(input.deal, input.face_up_seats),
        dealer: input.deal.dealer,
        vulnerability: input.deal.vulnerability,
        auction_entries: build_auction_entries(input.auction, input.bid_history),
        contract: input.contract,
        prompt_mode: input.prompt_mode,
    }
}

/// Build a PlayingViewport from engine state.
///
/// Filters hands through face_up_seats. During play, typically the
/// user's hand + dummy are visible.
pub fn build_playing_viewport(input: BuildPlayingViewportInput) -> PlayingViewport {
    let visible_hands = filter_visible_hands(input.deal, input.face_up_seats);
    let auction_entries = match (input.auction, input.bid_history) {
        (Some(auction), Some(history)) => Some(build_auction_entries(auction, history)),
        (Some(auction), None) => Some(build_auction_entries(auction, &[])),
        _ => None,
    };
    let bid_history = input.bid_history.map(|h| h.to_vec());

    PlayingViewport {
        user_seat: input.user_seat,
        rotated: input.rotated,
        visible_hands,
        dealer: input.deal.dealer,
        vulnerability: input.deal.vulnerability,
        contract: input.contract,
        current_player: input.current_player,
        current_trick: input.current_trick,
        trump_suit: input.trump_suit,
        legal_plays: input.legal_plays,
        user_controlled_seats: input.user_controlled_seats,
        remaining_cards: input.remaining_cards,
        tricks: input.tricks,
        declarer_tricks_won: input.declarer_tricks_won,
        defender_tricks_won: input.defender_tricks_won,
        auction_entries,
        bid_history,
    }
}

/// Build an ExplanationViewport from engine state.
///
/// All four hands are exposed — this is the review phase where
/// everything is visible.
pub fn build_explanation_viewport(input: BuildExplanationViewportInput) -> ExplanationViewport {
    let auction_entries = build_auction_entries(input.auction, &input.bid_history);

    ExplanationViewport {
        user_seat: input.user_seat,
        all_hands: input.deal.hands.clone(),
        dealer: input.deal.dealer,
        vulnerability: input.deal.vulnerability,
        auction_entries,
        contract: input.contract,
        score: input.score,
        declarer_tricks_won: input.declarer_tricks_won,
        defender_tricks_won: input.defender_tricks_won,
        bid_history: input.bid_history,
        tricks: input.tricks,
        play_recommendations: input.play_recommendations,
    }
}

#[cfg(test)]
mod tests {
    use super::super::viewport_types::AnnotationType;
    use super::*;
    use crate::types::PromptMode;
    use bridge_engine::types::{AuctionEntry, Card, Contract, Hand, Rank, Suit, Vulnerability};

    fn make_hand_13() -> Hand {
        Hand {
            cards: vec![
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Queen,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Jack,
                },
                Card {
                    suit: Suit::Hearts,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Hearts,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Hearts,
                    rank: Rank::Queen,
                },
                Card {
                    suit: Suit::Diamonds,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Diamonds,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Diamonds,
                    rank: Rank::Queen,
                },
                Card {
                    suit: Suit::Clubs,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Clubs,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Clubs,
                    rank: Rank::Queen,
                },
            ],
        }
    }

    fn make_deal() -> Deal {
        let mut hands = HashMap::new();
        hands.insert(Seat::South, make_hand_13());
        hands.insert(Seat::North, Hand { cards: vec![] });
        hands.insert(Seat::East, Hand { cards: vec![] });
        hands.insert(Seat::West, Hand { cards: vec![] });
        Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        }
    }

    // ── format_call tests ─────────────────────────────────────────

    #[test]
    fn format_call_pass() {
        assert_eq!(format_call(&Call::Pass), "Pass");
    }

    #[test]
    fn format_call_double() {
        assert_eq!(format_call(&Call::Double), "Dbl");
    }

    #[test]
    fn format_call_redouble() {
        assert_eq!(format_call(&Call::Redouble), "Rdbl");
    }

    #[test]
    fn format_call_bids() {
        assert_eq!(
            format_call(&Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            }),
            "1\u{2663}"
        );
        assert_eq!(
            format_call(&Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump
            }),
            "1NT"
        );
        assert_eq!(
            format_call(&Call::Bid {
                level: 3,
                strain: BidSuit::Hearts
            }),
            "3\u{2665}"
        );
        assert_eq!(
            format_call(&Call::Bid {
                level: 7,
                strain: BidSuit::Spades
            }),
            "7\u{2660}"
        );
        assert_eq!(
            format_call(&Call::Bid {
                level: 2,
                strain: BidSuit::Diamonds
            }),
            "2\u{2666}"
        );
    }

    // ── Bidding viewport tests ────────────────────────────────────

    #[test]
    fn bidding_viewport_only_shows_user_hand() {
        let deal = make_deal();
        let mut face_up = HashSet::new();
        face_up.insert(Seat::South);

        let viewport = build_bidding_viewport(BuildBiddingViewportInput {
            deal: &deal,
            user_seat: Seat::South,
            auction: &Auction {
                entries: vec![],
                is_complete: false,
            },
            bid_history: &[],
            legal_calls: &[Call::Pass],
            face_up_seats: &face_up,
            convention_name: "Test".to_string(),
            is_user_turn: true,
            current_bidder: Seat::South,
            practice_mode: None,
            bid_context: None,
            bidding_options: None,
        });

        // Only South's hand is visible
        assert_eq!(viewport.visible_hands.len(), 1);
        assert!(viewport.visible_hands.contains_key(&Seat::South));
        assert!(!viewport.visible_hands.contains_key(&Seat::North));
        assert_eq!(viewport.hand.cards.len(), 13);
        assert_eq!(viewport.seat, Seat::South);
        assert!(viewport.is_user_turn);
    }

    #[test]
    fn bidding_viewport_hand_evaluation() {
        let deal = make_deal();
        let face_up = HashSet::new();

        let viewport = build_bidding_viewport(BuildBiddingViewportInput {
            deal: &deal,
            user_seat: Seat::South,
            auction: &Auction {
                entries: vec![],
                is_complete: false,
            },
            bid_history: &[],
            legal_calls: &[],
            face_up_seats: &face_up,
            convention_name: "Test".to_string(),
            is_user_turn: false,
            current_bidder: Seat::North,
            practice_mode: None,
            bid_context: None,
            bidding_options: None,
        });

        // 4-3-3-3 shape with all face cards
        assert_eq!(viewport.hand_evaluation.shape, [4, 3, 3, 3]);
        assert!(viewport.hand_evaluation.is_balanced);
        assert!(viewport.hand_evaluation.hcp > 0);
    }

    // ── Explanation viewport shows all hands ──────────────────────

    #[test]
    fn explanation_viewport_shows_all_hands() {
        let deal = make_deal();

        let viewport = build_explanation_viewport(BuildExplanationViewportInput {
            deal: &deal,
            user_seat: Seat::South,
            auction: &Auction {
                entries: vec![],
                is_complete: false,
            },
            bid_history: vec![],
            contract: None,
            score: None,
            declarer_tricks_won: 0,
            defender_tricks_won: 0,
            tricks: vec![],
            play_recommendations: vec![],
        });

        // All four hands visible in review
        assert_eq!(viewport.all_hands.len(), 4);
        assert!(viewport.all_hands.contains_key(&Seat::North));
        assert!(viewport.all_hands.contains_key(&Seat::East));
        assert!(viewport.all_hands.contains_key(&Seat::South));
        assert!(viewport.all_hands.contains_key(&Seat::West));
    }

    // ── Playing viewport with dummy visible ───────────────────────

    #[test]
    fn playing_viewport_shows_user_and_dummy() {
        let deal = make_deal();
        let mut face_up = HashSet::new();
        face_up.insert(Seat::South);
        face_up.insert(Seat::North); // dummy

        let viewport = build_playing_viewport(BuildPlayingViewportInput {
            deal: &deal,
            user_seat: Seat::South,
            face_up_seats: &face_up,
            auction: None,
            bid_history: None,
            rotated: false,
            contract: Some(Contract {
                level: 3,
                strain: BidSuit::NoTrump,
                doubled: false,
                redoubled: false,
                declarer: Seat::South,
            }),
            current_player: Some(Seat::West),
            current_trick: vec![],
            trump_suit: None,
            legal_plays: vec![],
            user_controlled_seats: vec![Seat::South, Seat::North],
            remaining_cards: HashMap::new(),
            tricks: vec![],
            declarer_tricks_won: 0,
            defender_tricks_won: 0,
        });

        // South and North visible, not East/West
        assert_eq!(viewport.visible_hands.len(), 2);
        assert!(viewport.visible_hands.contains_key(&Seat::South));
        assert!(viewport.visible_hands.contains_key(&Seat::North));
        assert!(!viewport.visible_hands.contains_key(&Seat::East));
    }

    // ── Declarer prompt viewport ──────────────────────────────────

    #[test]
    fn declarer_prompt_viewport_filters_hands() {
        let deal = make_deal();
        let mut face_up = HashSet::new();
        face_up.insert(Seat::South);

        let viewport = build_declarer_prompt_viewport(BuildDeclarerPromptViewportInput {
            deal: &deal,
            user_seat: Seat::South,
            face_up_seats: &face_up,
            auction: &Auction {
                entries: vec![],
                is_complete: false,
            },
            bid_history: &[],
            contract: Contract {
                level: 4,
                strain: BidSuit::Hearts,
                doubled: false,
                redoubled: false,
                declarer: Seat::South,
            },
            prompt_mode: PromptMode::SouthDeclarer,
        });

        assert_eq!(viewport.visible_hands.len(), 1);
        assert!(viewport.visible_hands.contains_key(&Seat::South));
        assert_eq!(viewport.contract.level, 4);
        assert_eq!(viewport.prompt_mode, PromptMode::SouthDeclarer);
    }

    // ── filter_visible_hands ──────────────────────────────────────

    #[test]
    fn filter_visible_hands_empty_set() {
        let deal = make_deal();
        let face_up = HashSet::new();
        let visible = filter_visible_hands(&deal, &face_up);
        assert!(visible.is_empty());
    }

    #[test]
    fn filter_visible_hands_all_seats() {
        let deal = make_deal();
        let mut face_up = HashSet::new();
        face_up.insert(Seat::North);
        face_up.insert(Seat::East);
        face_up.insert(Seat::South);
        face_up.insert(Seat::West);
        let visible = filter_visible_hands(&deal, &face_up);
        assert_eq!(visible.len(), 4);
    }

    // ── build_auction_entries ──────────────────────────────────────

    #[test]
    fn build_auction_entries_with_history() {
        let auction = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump,
                    },
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
            ],
            is_complete: false,
        };
        let history = vec![BidHistoryEntryView {
            seat: Seat::North,
            call: Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            },
            meaning: Some("15-17 HCP, balanced".to_string()),
            is_user: false,
            is_correct: None,
            grade: None,
            prior_attempts: None,
            arc_label: None,
            alert_label: Some("15-17".to_string()),
            annotation_type: Some(AnnotationType::Announce),
        }];

        let entries = build_auction_entries(&auction, &history);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].call_display, "1NT");
        assert_eq!(entries[0].alert_label, Some("15-17".to_string()));
        assert_eq!(entries[0].annotation_type, Some(AnnotationType::Announce));
        assert_eq!(entries[1].call_display, "Pass");
        assert_eq!(entries[1].alert_label, None); // no history entry for index 1
    }
}
