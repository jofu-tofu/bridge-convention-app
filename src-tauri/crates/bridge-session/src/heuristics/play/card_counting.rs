//! Card counting heuristic — tracks known voids from failure to follow suit.
//!
//! Scans previous tricks for opponents who played off-suit when a suit was led,
//! revealing a void in that suit. Uses this information to guide lead choices:
//! - **When leading as defender:** Prefer leading through LHO's void (LHO plays
//!   before partner, so if LHO is void they can't beat partner's card). Avoid
//!   leading into RHO's void (RHO plays after the lead and could ruff).
//! - **When leading as declarer:** Prefer leading toward a known void in the
//!   defender sitting after dummy (they can't win the trick in that suit).

use std::collections::{HashMap, HashSet};

use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::{Card, Seat, Suit};

use crate::heuristics::play_types::{
    group_by_suit, is_defender, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

pub struct CardCountingHeuristic;

impl PlayHeuristic for CardCountingHeuristic {
    fn name(&self) -> &str {
        "card-counting"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        // Only on lead (empty current trick) and after at least one previous trick
        if !ctx.current_trick.is_empty() || ctx.previous_tricks.is_empty() {
            return None;
        }

        let voids = detect_voids(&ctx.previous_tricks, ctx.trump_suit);
        if voids.is_empty() {
            return None;
        }

        let suit_groups = group_by_suit(&ctx.legal_plays);

        if is_defender(ctx.seat, ctx.contract.declarer) {
            defender_lead(ctx, &voids, &suit_groups)
        } else {
            declarer_lead(ctx, &voids, &suit_groups)
        }
    }
}

/// Scan previous tricks for players who failed to follow suit → known voids.
fn detect_voids(
    tricks: &[bridge_engine::Trick],
    trump_suit: Option<Suit>,
) -> HashMap<Seat, HashSet<Suit>> {
    let mut voids: HashMap<Seat, HashSet<Suit>> = HashMap::new();

    for trick in tricks {
        if trick.plays.is_empty() {
            continue;
        }
        let led_suit = trick.plays[0].card.suit;

        for play in trick.plays.iter().skip(1) {
            if play.card.suit != led_suit {
                // Player didn't follow suit → void in led suit
                // (trumping or discarding both confirm a void)
                voids.entry(play.seat).or_default().insert(led_suit);
            }
        }
    }

    // Don't track voids in trump suit — ruffing trump is unusual and not useful info
    if let Some(ts) = trump_suit {
        for void_set in voids.values_mut() {
            void_set.remove(&ts);
        }
    }

    voids
}

/// Defender lead: prefer leading through LHO's known void.
/// LHO = next_seat(seat), RHO = previous seat (next_seat thrice).
fn defender_lead(
    ctx: &PlayContext,
    voids: &HashMap<Seat, HashSet<Suit>>,
    suit_groups: &[(Suit, Vec<Card>)],
) -> Option<Card> {
    let lho = next_seat(ctx.seat);
    let rho = partner_seat(lho); // = next_seat(next_seat(next_seat(seat)))

    // Suits where LHO is void → good to lead through
    let lho_voids = voids.get(&lho);
    // Suits where RHO is void → avoid leading into
    let rho_voids = voids.get(&rho);

    // Find a non-trump suit where LHO is void and we have cards
    if let Some(lho_v) = lho_voids {
        for &void_suit in lho_v {
            if Some(void_suit) == ctx.trump_suit {
                continue;
            }
            if let Some((_, cards)) = suit_groups.iter().find(|(s, _)| *s == void_suit) {
                return sort_by_rank_asc(cards).into_iter().next();
            }
        }
    }

    // Avoid suits where RHO is void: prefer any suit where RHO is NOT void
    if let Some(rho_v) = rho_voids {
        if !rho_v.is_empty() {
            let safe_suit = suit_groups
                .iter()
                .find(|(s, _)| Some(*s) != ctx.trump_suit && !rho_v.contains(s));
            if let Some((_, cards)) = safe_suit {
                return sort_by_rank_asc(cards).into_iter().next();
            }
        }
    }

    None
}

/// Declarer lead: prefer leading toward a known void in the defender after dummy.
fn declarer_lead(
    ctx: &PlayContext,
    voids: &HashMap<Seat, HashSet<Suit>>,
    suit_groups: &[(Suit, Vec<Card>)],
) -> Option<Card> {
    let dummy = partner_seat(ctx.contract.declarer);
    // Defender sitting after dummy (plays after dummy, before declarer partner responds)
    let defender_after_dummy = next_seat(dummy);

    if let Some(void_set) = voids.get(&defender_after_dummy) {
        for &void_suit in void_set {
            if Some(void_suit) == ctx.trump_suit {
                continue;
            }
            if let Some((_, cards)) = suit_groups.iter().find(|(s, _)| *s == void_suit) {
                return sort_by_rank_asc(cards).into_iter().next();
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Card, Contract, Hand, PlayedCard, Rank, Trick};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard {
            card: card(suit, rank),
            seat,
        }
    }

    fn suit_contract() -> Contract {
        Contract {
            level: 4,
            strain: BidSuit::Spades,
            doubled: false,
            redoubled: false,
            declarer: Seat::South,
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
    fn detects_void_from_off_suit_play() {
        // East plays a diamond when hearts were led → East is void in hearts
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Hearts, Rank::King),
                played(Seat::East, Suit::Diamonds, Rank::Three),
                played(Seat::South, Suit::Hearts, Rank::Ace),
                played(Seat::West, Suit::Hearts, Rank::Two),
            ],
            trump_suit: Some(Suit::Spades),
            winner: Some(Seat::South),
        };

        let voids = detect_voids(&[trick], Some(Suit::Spades));
        assert!(voids[&Seat::East].contains(&Suit::Hearts));
        assert!(!voids.contains_key(&Seat::West)); // West followed suit
    }

    #[test]
    fn defender_leads_through_lho_void() {
        // East is on lead. LHO of East = South. South is void in hearts.
        // East should lead hearts (through South's void).
        let prev = Trick {
            plays: vec![
                played(Seat::North, Suit::Hearts, Rank::King),
                played(Seat::East, Suit::Hearts, Rank::Two),
                played(Seat::South, Suit::Diamonds, Rank::Three), // South void in hearts
                played(Seat::West, Suit::Hearts, Rank::Four),
            ],
            trump_suit: Some(Suit::Spades),
            winner: Some(Seat::North),
        };

        let hand_cards = vec![
            card(Suit::Hearts, Rank::Five),
            card(Suit::Diamonds, Rank::Seven),
        ];
        let legal = hand_cards.clone();
        let ctx = PlayContext {
            hand: Hand { cards: hand_cards },
            current_trick: vec![],
            previous_tricks: vec![prev],
            contract: suit_contract(),
            seat: Seat::East, // defender, LHO = South
            trump_suit: Some(Suit::Spades),
            legal_plays: legal,
            dummy_hand: None,
            beliefs: None,
        };

        let h = CardCountingHeuristic;
        let result = h.apply(&ctx);
        assert!(result.is_some());
        assert_eq!(result.unwrap().suit, Suit::Hearts);
    }

    #[test]
    fn defender_avoids_rho_void() {
        // West is on lead. RHO of West = South. South is void in hearts.
        // West should avoid leading hearts (into South's void).
        let prev = Trick {
            plays: vec![
                played(Seat::North, Suit::Hearts, Rank::King),
                played(Seat::East, Suit::Hearts, Rank::Two),
                played(Seat::South, Suit::Diamonds, Rank::Three), // void in hearts
                played(Seat::West, Suit::Hearts, Rank::Four),
            ],
            trump_suit: Some(Suit::Spades),
            winner: Some(Seat::North),
        };

        let hand_cards = vec![
            card(Suit::Hearts, Rank::Five),
            card(Suit::Diamonds, Rank::Seven),
        ];
        let legal = hand_cards.clone();
        let ctx = PlayContext {
            hand: Hand { cards: hand_cards },
            current_trick: vec![],
            previous_tricks: vec![prev],
            contract: suit_contract(),
            seat: Seat::West, // defender, RHO = South
            trump_suit: Some(Suit::Spades),
            legal_plays: legal,
            dummy_hand: None,
            beliefs: None,
        };

        let h = CardCountingHeuristic;
        let result = h.apply(&ctx);
        assert!(result.is_some());
        // Should prefer diamonds (avoid hearts where RHO is void)
        assert_eq!(result.unwrap().suit, Suit::Diamonds);
    }

    #[test]
    fn does_not_fire_on_first_trick() {
        let ctx = PlayContext {
            hand: Hand {
                cards: vec![card(Suit::Spades, Rank::Ace)],
            },
            current_trick: vec![],
            previous_tricks: vec![],
            contract: nt_contract(),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
            beliefs: None,
        };

        assert!(CardCountingHeuristic.apply(&ctx).is_none());
    }

    #[test]
    fn does_not_fire_when_following() {
        let prev = Trick {
            plays: vec![
                played(Seat::North, Suit::Hearts, Rank::King),
                played(Seat::East, Suit::Diamonds, Rank::Three),
                played(Seat::South, Suit::Hearts, Rank::Ace),
                played(Seat::West, Suit::Hearts, Rank::Two),
            ],
            trump_suit: None,
            winner: Some(Seat::South),
        };

        let ctx = PlayContext {
            hand: Hand {
                cards: vec![card(Suit::Spades, Rank::Ace)],
            },
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::King)],
            previous_tricks: vec![prev],
            contract: nt_contract(),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
            beliefs: None,
        };

        assert!(CardCountingHeuristic.apply(&ctx).is_none());
    }
}
