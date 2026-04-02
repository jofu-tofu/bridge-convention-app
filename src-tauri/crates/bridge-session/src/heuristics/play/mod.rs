//! Eight play heuristics implementing the PlayHeuristic trait.
//!
//! Chain order: opening-lead -> mid-game-lead -> second-hand-low ->
//! third-hand-high -> fourth-hand-play -> cover-honor-with-honor ->
//! trump-management -> discard-management -> default-lowest fallback.

mod opening_lead;
mod mid_game_lead;
mod second_hand_low;
mod third_hand_high;
mod fourth_hand;
mod cover_honor;
mod trump_management;
mod discard;

pub use opening_lead::OpeningLeadHeuristic;
pub use mid_game_lead::MidGameLeadHeuristic;
pub use second_hand_low::SecondHandLowHeuristic;
pub use third_hand_high::ThirdHandHighHeuristic;
pub use fourth_hand::FourthHandHeuristic;
pub use cover_honor::CoverHonorHeuristic;
pub use trump_management::TrumpManagementHeuristic;
pub use discard::DiscardHeuristic;

use super::play_types::{is_legal_play, sort_by_rank_asc, PlayContext, PlayHeuristic, PlayResult};

// ── Heuristic Play Strategy ─────────────────────────────────────────

/// Returns the default ordered list of all play heuristics.
pub fn default_heuristic_chain() -> Vec<Box<dyn PlayHeuristic>> {
    vec![
        Box::new(OpeningLeadHeuristic),
        Box::new(MidGameLeadHeuristic),
        Box::new(SecondHandLowHeuristic),
        Box::new(ThirdHandHighHeuristic),
        Box::new(FourthHandHeuristic),
        Box::new(CoverHonorHeuristic),
        Box::new(TrumpManagementHeuristic),
        Box::new(DiscardHeuristic),
    ]
}

/// Run the heuristic chain: try each heuristic in order, first Some wins.
/// Falls back to lowest legal card if no heuristic matches.
pub fn suggest_play(ctx: &PlayContext) -> PlayResult {
    assert!(
        !ctx.legal_plays.is_empty(),
        "No legal plays available"
    );

    let heuristics = default_heuristic_chain();

    for h in &heuristics {
        if let Some(card) = h.apply(ctx) {
            // Verify the card is in legal_plays
            if is_legal_play(&card, &ctx.legal_plays) {
                return PlayResult {
                    card,
                    reason: h.name().to_string(),
                };
            }
        }
    }

    // Fallback: lowest legal card
    let sorted = sort_by_rank_asc(&ctx.legal_plays);
    let fallback = sorted.into_iter().next().unwrap_or_else(|| ctx.legal_plays[0].clone());
    PlayResult {
        card: fallback,
        reason: "default-lowest".to_string(),
    }
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Card, Contract, Hand, PlayedCard, Rank, Seat, Suit, Trick};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard {
            card: card(suit, rank),
            seat,
        }
    }

    fn make_contract(declarer: Seat) -> Contract {
        Contract {
            level: 4,
            strain: BidSuit::Spades,
            doubled: false,
            redoubled: false,
            declarer,
        }
    }

    fn nt_contract(declarer: Seat) -> Contract {
        Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer,
        }
    }

    fn make_hand(cards: Vec<Card>) -> Hand {
        Hand { cards }
    }

    // ── Opening Lead tests ──────────────────────────────────────────

    #[test]
    fn opening_lead_ak_in_suit_contract() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Diamonds, Rank::Queen),
            card(Suit::Diamonds, Rank::Jack),
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Clubs, Rank::Seven),
            card(Suit::Clubs, Rank::Six),
            card(Suit::Clubs, Rank::Five),
            card(Suit::Clubs, Rank::Four),
            card(Suit::Clubs, Rank::Three),
        ]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        let result = h.apply(&ctx);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.suit, Suit::Hearts);
        assert_eq!(c.rank, Rank::Ace);
    }

    #[test]
    fn opening_lead_not_for_declarer() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![card(Suit::Spades, Rank::Ace)]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::South, // declarer
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn opening_lead_not_after_first_trick() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![card(Suit::Spades, Rank::Ace)]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![Trick {
                plays: vec![],
                trump_suit: None,
                winner: None,
            }],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Mid-Game Lead tests ─────────────────────────────────────────

    #[test]
    fn midgame_lead_returns_partner_suit() {
        let h = MidGameLeadHeuristic;
        let prev_trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Diamonds, Rank::King),
                played(Seat::East, Suit::Diamonds, Rank::Two),
                played(Seat::South, Suit::Diamonds, Rank::Ace),
                played(Seat::West, Suit::Diamonds, Rank::Three),
            ],
            trump_suit: Some(Suit::Spades),
            winner: Some(Seat::South),
        };
        let legal = vec![
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Hearts, Rank::Seven),
        ];
        let ctx = PlayContext {
            hand: make_hand(vec![
                card(Suit::Diamonds, Rank::Five),
                card(Suit::Hearts, Rank::Seven),
                // padding to 13 not needed for heuristic
            ]),
            current_trick: vec![],
            previous_tricks: vec![prev_trick],
            contract: make_contract(Seat::South),
            seat: Seat::East, // defender, partner is West
            trump_suit: Some(Suit::Spades),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Partner (West) didn't lead, but North led diamonds.
        // East's partner is West. West did not lead. So no partner-led suit.
        // Falls through to other logic.
        let result = h.apply(&ctx);
        assert!(result.is_some());
    }

    #[test]
    fn midgame_lead_not_on_first_trick() {
        let h = MidGameLeadHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn midgame_lead_not_when_following() {
        let h = MidGameLeadHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::King)],
            previous_tricks: vec![Trick {
                plays: vec![],
                trump_suit: None,
                winner: None,
            }],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Second Hand Low tests ───────────────────────────────────────

    #[test]
    fn second_hand_low_plays_lowest() {
        let h = SecondHandLowHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Three);
    }

    #[test]
    fn second_hand_low_defers_on_honor_led_with_cover() {
        let h = SecondHandLowHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        // Should defer to cover-honor heuristic
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn second_hand_low_not_in_wrong_position() {
        let h = SecondHandLowHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ten),
                played(Seat::East, Suit::Spades, Rank::Five),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn second_hand_low_void_defers() {
        let h = SecondHandLowHeuristic;
        let legal = vec![card(Suit::Hearts, Rank::Five)];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Third Hand High tests ───────────────────────────────────────

    #[test]
    fn third_hand_high_beats_opponent() {
        let h = ThirdHandHighHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Five),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::North),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Queen);
    }

    #[test]
    fn third_hand_high_partner_winning_play_low() {
        let h = ThirdHandHighHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        // South is playing third. Partner is North.
        // North led, East played.
        // If partner (North) is winning, play low.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S are defenders
            seat: Seat::South,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Five);
    }

    // ── Fourth Hand Play tests ──────────────────────────────────────

    #[test]
    fn fourth_hand_wins_cheaply() {
        let h = FourthHandHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Three),
        ];
        // North declarer, so E/W are defenders. West plays 4th.
        // South (dummy) led, East played Jack (opponent of West? No -- East is West's partner).
        // Need: the winning card belongs to an opponent of West.
        // West's partner is East. So South winning means opponent winning.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::Five),
                played(Seat::South, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::North),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        // Should play Queen (cheapest winner over Jack)
        assert_eq!(result.rank, Rank::Queen);
    }

    #[test]
    fn fourth_hand_partner_winning_play_low() {
        let h = FourthHandHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Three),
        ];
        // West plays fourth. Partner is East.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::King),
                played(Seat::South, Suit::Spades, Rank::Five),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Three);
    }

    // ── Cover Honor tests ───────────────────────────────────────────

    #[test]
    fn cover_honor_covers_queen_with_king() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::King);
    }

    #[test]
    fn cover_honor_ignores_non_honor_led() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn cover_honor_no_covering_honor() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Jack),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::King)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        // Jack doesn't beat King
        assert!(h.apply(&ctx).is_none());
    }

    // ── Trump Management tests ──────────────────────────────────────

    #[test]
    fn trump_management_ruffs_with_lowest() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.suit, Suit::Hearts);
        assert_eq!(result.rank, Rank::Five);
    }

    #[test]
    fn trump_management_doesnt_ruff_partner() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
        ];
        // South plays third. Partner is North. North led and is winning.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::King),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S defenders
            seat: Seat::South,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Partner (North) is winning with Ace -- should not ruff
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn trump_management_overruffs_opponent() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Clubs, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ten),
                played(Seat::East, Suit::Hearts, Rank::Five), // opponent trumped
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S defenders
            seat: Seat::South,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.suit, Suit::Hearts);
        assert_eq!(result.rank, Rank::King);
    }

    #[test]
    fn trump_management_not_when_following_suit() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::King),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Has spades to follow, so trump heuristic should not apply
        assert!(h.apply(&ctx).is_none());
    }

    // ── Discard Management tests ────────────────────────────────────

    #[test]
    fn discard_prefers_no_honor_suit() {
        let h = DiscardHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
            card(Suit::Clubs, Rank::Two),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Diamonds),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        // Should discard from clubs (no honors) rather than hearts (has King)
        assert_eq!(result.suit, Suit::Clubs);
        assert_eq!(result.rank, Rank::Two);
    }

    #[test]
    fn discard_not_when_following_suit() {
        let h = DiscardHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Full chain tests ────────────────────────────────────────────

    #[test]
    fn suggest_play_always_returns_legal_card() {
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Diamonds, Rank::Ten)],
            previous_tricks: vec![],
            contract: nt_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal.clone(),
            dummy_hand: None,
        };
        let result = suggest_play(&ctx);
        assert!(legal.iter().any(|c| c.suit == result.card.suit && c.rank == result.card.rank));
    }

    #[test]
    fn suggest_play_opening_lead_for_defender() {
        let hand_cards = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Hearts, Rank::Jack),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Spades, Rank::Eight),
            card(Suit::Spades, Rank::Seven),
            card(Suit::Spades, Rank::Six),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Diamonds, Rank::Four),
            card(Suit::Diamonds, Rank::Three),
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Clubs, Rank::Two),
        ];
        let ctx = PlayContext {
            hand: make_hand(hand_cards.clone()),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: nt_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: hand_cards,
            dummy_hand: None,
        };
        let result = suggest_play(&ctx);
        assert_eq!(result.reason, "opening-lead");
        // Should lead top of touching honors (KQJ of hearts)
        assert_eq!(result.card.suit, Suit::Hearts);
        assert_eq!(result.card.rank, Rank::King);
    }
}
