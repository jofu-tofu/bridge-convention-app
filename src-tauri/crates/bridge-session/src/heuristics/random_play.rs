//! Random play strategy: selects uniformly at random from legal plays.
//!
//! Uses a seeded ChaCha8Rng for deterministic replay when given the same seed.

use rand::Rng;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

use super::play_types::{PlayContext, PlayResult};

/// Random play strategy with a seeded RNG for reproducibility.
pub struct RandomPlayStrategy {
    rng: std::cell::RefCell<ChaCha8Rng>,
}

impl RandomPlayStrategy {
    /// Create a new RandomPlayStrategy with the given seed.
    pub fn new(seed: u64) -> Self {
        Self {
            rng: std::cell::RefCell::new(ChaCha8Rng::seed_from_u64(seed)),
        }
    }

    /// Suggest a random legal play.
    pub fn suggest(&self, ctx: &PlayContext) -> PlayResult {
        assert!(!ctx.legal_plays.is_empty(), "No legal cards to play");

        let index = self.rng.borrow_mut().gen_range(0..ctx.legal_plays.len());
        PlayResult {
            card: ctx.legal_plays[index].clone(),
            reason: "random".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Card, Contract, Hand, Rank, Seat, Suit};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn make_ctx(legal_plays: Vec<Card>) -> PlayContext {
        PlayContext {
            hand: Hand {
                cards: legal_plays.clone(),
            },
            current_trick: vec![],
            previous_tricks: vec![],
            contract: Contract {
                level: 3,
                strain: BidSuit::NoTrump,
                doubled: false,
                redoubled: false,
                declarer: Seat::South,
            },
            seat: Seat::West,
            trump_suit: None,
            legal_plays,
            dummy_hand: None,
            beliefs: None,
        }
    }

    #[test]
    fn random_play_returns_legal_card() {
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Diamonds, Rank::Queen),
        ];
        let strategy = RandomPlayStrategy::new(42);
        let result = strategy.suggest(&make_ctx(legal.clone()));
        assert!(legal
            .iter()
            .any(|c| c.suit == result.card.suit && c.rank == result.card.rank));
    }

    #[test]
    fn same_seed_same_result() {
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Diamonds, Rank::Queen),
            card(Suit::Clubs, Rank::Jack),
        ];
        let ctx = make_ctx(legal);
        let s1 = RandomPlayStrategy::new(123);
        let s2 = RandomPlayStrategy::new(123);
        let r1 = s1.suggest(&ctx);
        let r2 = s2.suggest(&ctx);
        assert_eq!(r1.card, r2.card);
    }

    #[test]
    fn different_seed_likely_different() {
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Diamonds, Rank::Queen),
            card(Suit::Clubs, Rank::Jack),
            card(Suit::Spades, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Diamonds, Rank::Four),
            card(Suit::Clubs, Rank::Five),
        ];
        let ctx = make_ctx(legal);
        // Run many seeds and check we get at least 2 different results
        let mut seen = std::collections::HashSet::new();
        for seed in 0..20 {
            let s = RandomPlayStrategy::new(seed);
            let r = s.suggest(&ctx);
            seen.insert(format!("{:?}{:?}", r.card.suit, r.card.rank));
        }
        assert!(
            seen.len() > 1,
            "Expected different results from different seeds"
        );
    }

    #[test]
    fn single_legal_play() {
        let legal = vec![card(Suit::Spades, Rank::Ace)];
        let strategy = RandomPlayStrategy::new(0);
        let result = strategy.suggest(&make_ctx(legal));
        assert_eq!(result.card.suit, Suit::Spades);
        assert_eq!(result.card.rank, Rank::Ace);
    }
}
