//! Top-level MC+DDS card suggestion entry point.

use rand::thread_rng;

use bridge_engine::constants::bid_suit_to_suit;

use super::{
    card_key, evaluate_cards, rank_to_u8, sample_deals, seat_to_dds_index, suit_to_dds_index,
    DdsSolverFn, McddCardScore, McddConfig, McddParams, McddResult,
};

/// Run MC+DDS suggestion for the current play state.
pub async fn mc_dds_suggest(
    params: &McddParams,
    use_constraints: bool,
    solver: &mut DdsSolverFn,
) -> Option<McddResult> {
    let config = McddConfig::default();
    let mut rng = thread_rng();
    mc_dds_suggest_with_rng(params, &config, use_constraints, &mut rng, solver).await
}

async fn mc_dds_suggest_with_rng(
    params: &McddParams,
    config: &McddConfig,
    use_constraints: bool,
    rng: &mut impl rand::Rng,
    solver: &mut DdsSolverFn,
) -> Option<McddResult> {
    if params.legal_plays.len() == 1 {
        let forced_card = params.legal_plays[0].clone();
        return Some(McddResult {
            best_card: forced_card.clone(),
            reason: "mc-dds:forced".to_string(),
            scores: std::collections::HashMap::from([(
                card_key(&forced_card),
                McddCardScore {
                    avg_tricks: 0.0,
                    count: 0,
                },
            )]),
            samples_used: 0,
        });
    }

    let sampled_deals = sample_deals(
        &params.remaining_cards,
        &params.visible_seats,
        &params.beliefs,
        use_constraints,
        config.sample_count,
        config.sample_count * config.max_attempts_multiplier,
        rng,
    );
    if sampled_deals.is_empty() {
        return None;
    }

    let trump = bid_suit_to_suit(params.contract.strain)
        .map(suit_to_dds_index)
        .unwrap_or(4);
    let lead_seat = params
        .current_trick
        .first()
        .map(|play| play.seat)
        .unwrap_or(params.seat);
    let current_seat = seat_to_dds_index(lead_seat);
    let current_trick_suit = params
        .current_trick
        .iter()
        .map(|play| suit_to_dds_index(play.card.suit))
        .collect::<Vec<_>>();
    let current_trick_rank = params
        .current_trick
        .iter()
        .map(|play| rank_to_u8(play.card.rank))
        .collect::<Vec<_>>();

    evaluate_cards(
        &params.legal_plays,
        &sampled_deals,
        config,
        trump,
        current_seat,
        &current_trick_suit,
        &current_trick_rank,
        solver,
    )
    .await
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use bridge_engine::types::{BidSuit, Contract, Rank, Seat, Suit};
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

    use crate::dds::test_support::{block_on, card, mock_solver};
    use crate::dds::{DdsCardResult, McddParams, SolveBoardResponse};
    use crate::inference::types::{DerivedRanges, NumberRange};

    use super::mc_dds_suggest_with_rng;

    fn nt_contract() -> Contract {
        Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer: Seat::South,
        }
    }

    fn open_ranges() -> HashMap<Suit, NumberRange> {
        HashMap::from([
            (Suit::Spades, NumberRange { min: 0, max: 13 }),
            (Suit::Hearts, NumberRange { min: 0, max: 13 }),
            (Suit::Diamonds, NumberRange { min: 0, max: 13 }),
            (Suit::Clubs, NumberRange { min: 0, max: 13 }),
        ])
    }

    #[test]
    fn mc_dds_suggest_shortcuts_for_forced_play() {
        let params = McddParams {
            seat: Seat::South,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            contract: nt_contract(),
            current_trick: Vec::new(),
            remaining_cards: HashMap::from([(Seat::South, vec![card(Suit::Spades, Rank::Ace)])]),
            visible_seats: vec![Seat::South],
            beliefs: HashMap::new(),
        };
        let mut solver = mock_solver(HashMap::new());
        let mut rng = ChaCha8Rng::seed_from_u64(1);

        let result = block_on(mc_dds_suggest_with_rng(
            &params,
            &crate::dds::McddConfig::default(),
            false,
            &mut rng,
            &mut solver,
        ))
        .unwrap();

        assert_eq!(result.reason, "mc-dds:forced");
        assert_eq!(result.best_card, card(Suit::Spades, Rank::Ace));
        assert_eq!(result.samples_used, 0);
    }

    #[test]
    fn mc_dds_suggest_runs_sampling_and_evaluation_end_to_end() {
        let remaining_cards = HashMap::from([
            (Seat::North, Vec::new()),
            (
                Seat::East,
                vec![
                    card(Suit::Spades, Rank::Ace),
                    card(Suit::Spades, Rank::King),
                ],
            ),
            (Seat::South, Vec::new()),
            (
                Seat::West,
                vec![card(Suit::Clubs, Rank::Two), card(Suit::Clubs, Rank::Three)],
            ),
        ]);
        let mut suit_lengths = open_ranges();
        suit_lengths.insert(Suit::Spades, NumberRange { min: 2, max: 2 });
        suit_lengths.insert(Suit::Clubs, NumberRange { min: 0, max: 0 });
        let beliefs = HashMap::from([(
            Seat::East,
            DerivedRanges {
                hcp: NumberRange { min: 7, max: 7 },
                suit_lengths,
                is_balanced: None,
            },
        )]);

        let sampled = HashMap::from([
            (Seat::North, Vec::new()),
            (
                Seat::East,
                vec![
                    card(Suit::Spades, Rank::Ace),
                    card(Suit::Spades, Rank::King),
                ],
            ),
            (Seat::South, Vec::new()),
            (
                Seat::West,
                vec![card(Suit::Clubs, Rank::Two), card(Suit::Clubs, Rank::Three)],
            ),
        ]);
        let responses = HashMap::from([(
            crate::dds::remaining_cards_to_pbn(&sampled),
            SolveBoardResponse {
                cards: vec![
                    DdsCardResult {
                        suit: Suit::Spades,
                        rank: 14,
                        score: 9,
                    },
                    DdsCardResult {
                        suit: Suit::Spades,
                        rank: 13,
                        score: 8,
                    },
                ],
            },
        )]);
        let params = McddParams {
            seat: Seat::South,
            legal_plays: vec![
                card(Suit::Spades, Rank::Ace),
                card(Suit::Spades, Rank::King),
            ],
            contract: nt_contract(),
            current_trick: Vec::new(),
            remaining_cards,
            visible_seats: vec![Seat::North, Seat::South],
            beliefs,
        };
        let mut solver = mock_solver(responses);
        let mut rng = ChaCha8Rng::seed_from_u64(9);

        let result = block_on(mc_dds_suggest_with_rng(
            &params,
            &crate::dds::McddConfig::default(),
            true,
            &mut rng,
            &mut solver,
        ))
        .unwrap();

        assert_eq!(result.best_card, card(Suit::Spades, Rank::Ace));
        assert_eq!(result.reason, "mc-dds:early");
        assert_eq!(result.samples_used, 15);
    }
}
