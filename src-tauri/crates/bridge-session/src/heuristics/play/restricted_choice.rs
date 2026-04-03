//! Restricted choice heuristic — Bayesian reasoning about touching honors.
//!
//! When an opponent plays a single honor in a position where they might have held
//! equivalent touching honors, restricted choice says the played honor is more
//! likely singleton than from a combined holding. Example: you hold AQ10, RHO plays
//! the J — restricted choice says J is more likely singleton than from KJ, so
//! finesse through LHO on the next round rather than playing for the drop.
//!
//! This heuristic fires when:
//! 1. We're on lead (current_trick is empty, after at least one previous trick)
//! 2. An opponent played a single honor in a prior trick that looks like a
//!    restricted-choice situation
//! 3. We're in a subsequent position in the same suit where a finesse is possible
//!
//! Gated behind `PlayProfile.use_inferences` (Expert+ only).

use std::collections::{HashMap, HashSet};

use bridge_engine::constants::partner_seat;
use bridge_engine::{Card, Rank, Seat, Suit};

use crate::heuristics::play_types::{
    group_by_suit, is_honor, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

/// Touching honor pairs where restricted choice applies.
/// If an opponent plays one of these honors, the other is more likely to sit
/// with their partner than to be behind the played honor.
const TOUCHING_PAIRS: &[(Rank, Rank)] = &[
    (Rank::King, Rank::Queen),
    (Rank::Queen, Rank::Jack),
    (Rank::Jack, Rank::Ten),
];

pub struct RestrictedChoiceHeuristic;

impl PlayHeuristic for RestrictedChoiceHeuristic {
    fn name(&self) -> &str {
        "restricted-choice"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        // Only when on lead, after at least one trick
        if !ctx.current_trick.is_empty() || ctx.previous_tricks.is_empty() {
            return None;
        }

        let signals = find_restricted_choice_signals(&ctx.previous_tricks, ctx.seat, ctx.contract.declarer);
        if signals.is_empty() {
            return None;
        }

        let suit_groups = group_by_suit(&ctx.legal_plays);

        // Look for a suit where we have a restricted-choice signal and can finesse
        for signal in &signals {
            if let Some(card) = suggest_finesse(ctx, signal, &suit_groups) {
                return Some(card);
            }
        }

        None
    }
}

/// A restricted choice signal: an opponent played a single honor that could
/// have been from touching honors.
#[derive(Debug)]
#[allow(dead_code)] // Fields used in tests and future finesse-direction logic
struct RestrictedChoiceSignal {
    /// The suit where the signal was observed
    suit: Suit,
    /// The opponent who played the honor
    opponent: Seat,
    /// The honor that was played
    played_rank: Rank,
    /// The touching honor we expect to be with their partner
    missing_rank: Rank,
}

/// Scan previous tricks for restricted-choice signals from opponents.
fn find_restricted_choice_signals(
    tricks: &[bridge_engine::Trick],
    our_seat: Seat,
    _declarer: Seat,
) -> Vec<RestrictedChoiceSignal> {
    let partner = partner_seat(our_seat);
    let mut signals = Vec::new();

    // Track which honors each seat has already played (avoid double-counting)
    let mut played_honors: HashMap<(Seat, Suit), HashSet<Rank>> = HashMap::new();

    for trick in tricks {
        for play in &trick.plays {
            if is_honor(play.card.rank) {
                played_honors
                    .entry((play.seat, play.card.suit))
                    .or_default()
                    .insert(play.card.rank);
            }
        }
    }

    // Look for opponents who played exactly one of a touching pair
    let opponents: Vec<Seat> = [Seat::North, Seat::East, Seat::South, Seat::West]
        .iter()
        .copied()
        .filter(|&s| s != our_seat && s != partner)
        .collect();

    for &opp in &opponents {
        for &suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
            let honors = match played_honors.get(&(opp, suit)) {
                Some(h) => h,
                None => continue,
            };

            for &(high, low) in TOUCHING_PAIRS {
                // Opponent played exactly one of the touching pair
                let played_high = honors.contains(&high);
                let played_low = honors.contains(&low);

                if played_high && !played_low {
                    // They played the higher honor — the lower is more likely
                    // to be with their partner (restricted choice)
                    signals.push(RestrictedChoiceSignal {
                        suit,
                        opponent: opp,
                        played_rank: high,
                        missing_rank: low,
                    });
                } else if played_low && !played_high {
                    signals.push(RestrictedChoiceSignal {
                        suit,
                        opponent: opp,
                        played_rank: low,
                        missing_rank: high,
                    });
                }
            }
        }
    }

    signals
}

/// Given a restricted choice signal, suggest a finesse if we have the right
/// holding in the suit.
fn suggest_finesse(
    _ctx: &PlayContext,
    signal: &RestrictedChoiceSignal,
    suit_groups: &[(Suit, Vec<Card>)],
) -> Option<Card> {
    let (_, cards) = suit_groups.iter().find(|(s, _)| *s == signal.suit)?;

    // We need cards in this suit to lead
    if cards.is_empty() {
        return None;
    }

    // Restricted choice reasoning: the missing honor is more likely with the
    // opponent's partner. Lead low in the suit to finesse — our higher cards
    // (if any) will beat the missing honor if it's with the expected opponent.
    //
    // Only suggest leading this suit; the actual card play (finesse direction)
    // depends on position. Lead low to preserve options.
    let sorted = sort_by_rank_asc(cards);
    sorted.into_iter().next()
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Contract, Hand, PlayedCard, Trick};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard {
            card: card(suit, rank),
            seat,
        }
    }

    fn nt_contract() -> Contract {
        Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer: Seat::South,
        }
    }

    #[test]
    fn detects_restricted_choice_signal() {
        // South is declarer, East (RHO) played the Jack of spades.
        // Restricted choice: the Queen is more likely with West than East having KJ.
        let trick = Trick {
            plays: vec![
                played(Seat::South, Suit::Spades, Rank::Three),
                played(Seat::West, Suit::Spades, Rank::Two),
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            trump_suit: None,
            winner: Some(Seat::North),
        };

        let signals =
            find_restricted_choice_signals(&[trick], Seat::South, Seat::South);
        assert!(!signals.is_empty());
        let sig = signals.iter().find(|s| s.suit == Suit::Spades).unwrap();
        assert_eq!(sig.opponent, Seat::East);
        assert_eq!(sig.played_rank, Rank::Jack);
        assert_eq!(sig.missing_rank, Rank::Queen);
    }

    #[test]
    fn suggests_finesse_in_signal_suit() {
        // Hold AQ10 of spades. RHO (East) played J on first round.
        // Restricted choice → finesse (lead spades again).
        let prev = Trick {
            plays: vec![
                played(Seat::South, Suit::Spades, Rank::Three),
                played(Seat::West, Suit::Spades, Rank::Two),
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            trump_suit: None,
            winner: Some(Seat::North),
        };

        let hand_cards = vec![
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Ten),
            card(Suit::Hearts, Rank::Five),
        ];
        let legal = hand_cards.clone();
        let ctx = PlayContext {
            hand: Hand { cards: hand_cards },
            current_trick: vec![],
            previous_tricks: vec![prev],
            contract: nt_contract(),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
            beliefs: None,
        };

        let result = RestrictedChoiceHeuristic.apply(&ctx);
        assert!(result.is_some());
        let card = result.unwrap();
        assert_eq!(card.suit, Suit::Spades);
    }

    #[test]
    fn no_signal_when_no_honors_played() {
        let trick = Trick {
            plays: vec![
                played(Seat::South, Suit::Spades, Rank::Three),
                played(Seat::West, Suit::Spades, Rank::Two),
                played(Seat::North, Suit::Spades, Rank::Five),
                played(Seat::East, Suit::Spades, Rank::Four),
            ],
            trump_suit: None,
            winner: Some(Seat::North),
        };

        let signals =
            find_restricted_choice_signals(&[trick], Seat::South, Seat::South);
        assert!(signals.is_empty());
    }

    #[test]
    fn does_not_fire_on_first_trick() {
        let ctx = PlayContext {
            hand: Hand { cards: vec![card(Suit::Spades, Rank::Ace)] },
            current_trick: vec![],
            previous_tricks: vec![],
            contract: nt_contract(),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
            beliefs: None,
        };

        assert!(RestrictedChoiceHeuristic.apply(&ctx).is_none());
    }
}
