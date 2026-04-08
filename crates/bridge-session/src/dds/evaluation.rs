//! Batched DDS evaluation over sampled remaining-card deals.

use std::collections::HashMap;

use bridge_engine::types::Card;

use super::{card_key, dds_card_key, McddCardScore, McddConfig, McddResult, SolveBoardRequest};
use crate::dds::pbn::remaining_cards_to_pbn;

#[derive(Debug, Clone)]
struct AccumEntry {
    key: String,
    total_tricks: i32,
    count: usize,
}

/// Evaluate legal cards by solving sampled deals in DDS batches.
pub async fn evaluate_cards(
    legal_cards: &[Card],
    sampled_deals: &[HashMap<bridge_engine::types::Seat, Vec<Card>>],
    config: &McddConfig,
    trump: u8,
    current_seat: u8,
    current_trick_suit: &[u8],
    current_trick_rank: &[u8],
    solver: &mut super::DdsSolverFn,
) -> Option<McddResult> {
    if sampled_deals.is_empty() || legal_cards.is_empty() {
        return None;
    }

    let mut accum = legal_cards
        .iter()
        .map(|card| AccumEntry {
            key: card_key(card),
            total_tricks: 0,
            count: 0,
        })
        .collect::<Vec<_>>();
    let key_to_index = accum
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.key.clone(), index))
        .collect::<HashMap<_, _>>();

    let mut deal_index = 0usize;
    let mut reason = "mc-dds".to_string();

    for _batch in 0..config.max_batches {
        if deal_index >= sampled_deals.len() {
            break;
        }

        let batch_end = (deal_index + config.batch_size).min(sampled_deals.len());
        while deal_index < batch_end {
            let request = SolveBoardRequest {
                trump,
                first: current_seat,
                current_trick_suit: current_trick_suit.to_vec(),
                current_trick_rank: current_trick_rank.to_vec(),
                remain_cards_pbn: remaining_cards_to_pbn(&sampled_deals[deal_index]),
            };

            if let Ok(response) = (solver)(request).await {
                for entry in response.cards {
                    if let Some(key) = dds_card_key(entry.suit, entry.rank) {
                        if let Some(index) = key_to_index.get(&key) {
                            let score = &mut accum[*index];
                            score.total_tricks += entry.score;
                            score.count += 1;
                        }
                    }
                }
            }

            deal_index += 1;
        }

        if top_two_margin(&accum).is_some_and(|margin| margin >= 0.5) {
            reason = "mc-dds:early".to_string();
            break;
        }
    }

    if accum.iter().all(|entry| entry.count == 0) {
        return None;
    }

    if reason == "mc-dds"
        && deal_index < sampled_deals.len()
        && top_two_margin(&accum).is_some_and(|margin| margin < 0.5)
    {
        let extension_end = (deal_index + config.batch_size).min(sampled_deals.len());
        while deal_index < extension_end {
            let request = SolveBoardRequest {
                trump,
                first: current_seat,
                current_trick_suit: current_trick_suit.to_vec(),
                current_trick_rank: current_trick_rank.to_vec(),
                remain_cards_pbn: remaining_cards_to_pbn(&sampled_deals[deal_index]),
            };

            if let Ok(response) = (solver)(request).await {
                for entry in response.cards {
                    if let Some(key) = dds_card_key(entry.suit, entry.rank) {
                        if let Some(index) = key_to_index.get(&key) {
                            let score = &mut accum[*index];
                            score.total_tricks += entry.score;
                            score.count += 1;
                        }
                    }
                }
            }

            deal_index += 1;
        }
        reason = "mc-dds:extended".to_string();
    }

    let mut scores = HashMap::new();
    let mut best_index = None;
    let mut best_avg = f64::NEG_INFINITY;

    for (index, entry) in accum.iter().enumerate() {
        if entry.count == 0 {
            continue;
        }
        let avg = entry.total_tricks as f64 / entry.count as f64;
        scores.insert(
            entry.key.clone(),
            McddCardScore {
                avg_tricks: avg,
                count: entry.count,
            },
        );
        if avg > best_avg {
            best_avg = avg;
            best_index = Some(index);
        }
    }

    let best_card = best_index.and_then(|index| legal_cards.get(index).cloned())?;
    let samples_used = accum.iter().map(|entry| entry.count).max().unwrap_or(0);

    Some(McddResult {
        best_card,
        reason,
        scores,
        samples_used,
    })
}

fn top_two_margin(accum: &[AccumEntry]) -> Option<f64> {
    let mut averages = accum
        .iter()
        .filter(|entry| entry.count > 0)
        .map(|entry| entry.total_tricks as f64 / entry.count as f64)
        .collect::<Vec<_>>();
    if averages.len() < 2 {
        return None;
    }
    averages.sort_by(|left, right| right.partial_cmp(left).unwrap_or(std::cmp::Ordering::Equal));
    Some(averages[0] - averages[1])
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use bridge_engine::types::{Rank, Seat, Suit};

    use crate::dds::test_support::{block_on, card, mock_solver};
    use crate::dds::{DdsCardResult, McddConfig, SolveBoardResponse};

    use super::evaluate_cards;

    fn sampled_deal(id: usize) -> HashMap<Seat, Vec<bridge_engine::types::Card>> {
        let north = match id {
            0 => vec![card(Suit::Spades, Rank::Ace)],
            1 => vec![card(Suit::Spades, Rank::King)],
            2 => vec![card(Suit::Spades, Rank::Queen)],
            _ => vec![card(Suit::Spades, Rank::Jack)],
        };
        HashMap::from([
            (Seat::North, north),
            (Seat::East, vec![card(Suit::Hearts, Rank::Two)]),
            (Seat::South, vec![card(Suit::Clubs, Rank::Two)]),
            (Seat::West, vec![card(Suit::Diamonds, Rank::Two)]),
        ])
    }

    #[test]
    fn evaluate_cards_stops_early_when_top_two_diverge() {
        let deals = vec![
            sampled_deal(0),
            sampled_deal(1),
            sampled_deal(2),
            sampled_deal(3),
        ];
        let responses = HashMap::from([
            (
                crate::dds::remaining_cards_to_pbn(&deals[0]),
                SolveBoardResponse {
                    cards: vec![
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 14,
                            score: 8,
                        },
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 13,
                            score: 7,
                        },
                    ],
                },
            ),
            (
                crate::dds::remaining_cards_to_pbn(&deals[1]),
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
            ),
            (
                crate::dds::remaining_cards_to_pbn(&deals[2]),
                SolveBoardResponse {
                    cards: vec![
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 14,
                            score: 1,
                        },
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 13,
                            score: 12,
                        },
                    ],
                },
            ),
            (
                crate::dds::remaining_cards_to_pbn(&deals[3]),
                SolveBoardResponse {
                    cards: vec![
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 14,
                            score: 1,
                        },
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 13,
                            score: 12,
                        },
                    ],
                },
            ),
        ]);
        let mut solver = mock_solver(responses);

        let result = block_on(evaluate_cards(
            &[
                card(Suit::Spades, Rank::Ace),
                card(Suit::Spades, Rank::King),
            ],
            &deals,
            &McddConfig {
                sample_count: 4,
                batch_size: 2,
                max_batches: 2,
                max_attempts_multiplier: 20,
            },
            4,
            2,
            &[],
            &[],
            &mut solver,
        ))
        .unwrap();

        assert_eq!(result.best_card, card(Suit::Spades, Rank::Ace));
        assert_eq!(result.reason, "mc-dds:early");
        assert_eq!(result.samples_used, 2);
    }

    #[test]
    fn evaluate_cards_runs_extension_batch_for_close_call() {
        let deals = vec![sampled_deal(0), sampled_deal(1), sampled_deal(2)];
        let responses = HashMap::from([
            (
                crate::dds::remaining_cards_to_pbn(&deals[0]),
                SolveBoardResponse {
                    cards: vec![
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 14,
                            score: 8,
                        },
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 13,
                            score: 8,
                        },
                    ],
                },
            ),
            (
                crate::dds::remaining_cards_to_pbn(&deals[1]),
                SolveBoardResponse {
                    cards: vec![
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 14,
                            score: 7,
                        },
                        DdsCardResult {
                            suit: Suit::Spades,
                            rank: 13,
                            score: 7,
                        },
                    ],
                },
            ),
            (
                crate::dds::remaining_cards_to_pbn(&deals[2]),
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
            ),
        ]);
        let mut solver = mock_solver(responses);

        let result = block_on(evaluate_cards(
            &[
                card(Suit::Spades, Rank::Ace),
                card(Suit::Spades, Rank::King),
            ],
            &deals,
            &McddConfig {
                sample_count: 3,
                batch_size: 1,
                max_batches: 2,
                max_attempts_multiplier: 20,
            },
            4,
            2,
            &[],
            &[],
            &mut solver,
        ))
        .unwrap();

        assert_eq!(result.best_card, card(Suit::Spades, Rank::Ace));
        assert_eq!(result.reason, "mc-dds:extended");
        assert_eq!(result.samples_used, 3);
    }
}
