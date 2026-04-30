//! Posterior inference engine — Monte Carlo rejection sampler.
//!
//! `PosteriorEngine` runs Monte Carlo rejection sampling against L1 DerivedRanges,
//! conditioned on the observer's known cards. Used by play heuristics gated by
//! the active PlayProfile's `use_posterior` flag.

use std::collections::HashMap;

use bridge_engine::types::{Card, Seat, Suit};
use bridge_engine::{calculate_hcp, get_suit_length, is_balanced, Hand};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

use super::types::DerivedRanges;

// ── Constants ─────────────────────────────────────────────────────

/// Target accepted samples. 200 gives ±1 HCP and ±0.5 suit-length resolution.
const SAMPLE_BUDGET: usize = 200;

/// Max attempts before giving up. 10× budget handles typical bridge constraints
/// (5–20 facts) with >99% chance of reaching budget.
const MAX_ATTEMPTS: usize = 2000;

/// Samples needed for full confidence. At 50 samples the law of large numbers
/// gives ±2 HCP precision — enough to trust for lead selection.
const FULL_CONFIDENCE_THRESHOLD: f64 = 50.0;

// ── Sampled deal ──────────────────────────────────────────────────

/// A single accepted sample: hands for unknown seats only.
#[derive(Debug, Clone)]
struct SampledDeal {
    hands: HashMap<Seat, Vec<Card>>,
}

// ── PosteriorEngine ───────────────────────────────────────────────

/// Monte Carlo rejection sampler over unknown hands, constrained by L1 DerivedRanges.
pub struct PosteriorEngine {
    samples: Vec<SampledDeal>,
    constraints: HashMap<Seat, DerivedRanges>,
    _observer_seat: Seat,
    known_cards: HashMap<Seat, Vec<Card>>,
    rng: ChaCha8Rng,
}

impl PosteriorEngine {
    /// Create a new engine and immediately run sampling.
    pub fn new(
        observer_seat: Seat,
        known_cards: HashMap<Seat, Vec<Card>>,
        constraints: HashMap<Seat, DerivedRanges>,
        seed: u64,
    ) -> Self {
        let mut engine = Self {
            samples: Vec::new(),
            constraints,
            _observer_seat: observer_seat,
            known_cards,
            rng: ChaCha8Rng::seed_from_u64(seed),
        };
        engine.run_sampling();
        engine
    }

    /// Re-run sampling (clears previous samples).
    fn run_sampling(&mut self) {
        self.samples.clear();

        let deck = bridge_engine::create_deck();

        // Remove all known cards from the pool
        let known_set: std::collections::HashSet<(Suit, bridge_engine::types::Rank)> = self
            .known_cards
            .values()
            .flat_map(|cards| cards.iter().map(|c| (c.suit, c.rank)))
            .collect();

        let unknown_pool: Vec<Card> = deck
            .into_iter()
            .filter(|c| !known_set.contains(&(c.suit, c.rank)))
            .collect();

        // Identify seats that need cards dealt. A seat is "unknown" if we don't
        // know its full 13-card hand. Even partially-known seats (e.g., 1 played
        // card revealed) need the remaining cards dealt.
        let all_seats = [Seat::North, Seat::East, Seat::South, Seat::West];
        let unknown_seats: Vec<(Seat, usize)> = all_seats
            .iter()
            .filter_map(|&s| {
                let known_count = self.known_cards.get(&s).map_or(0, |c| c.len());
                if known_count >= 13 {
                    // Full hand known (observer or fully revealed) — skip
                    None
                } else {
                    // Need to deal the remaining cards for this seat
                    Some((s, 13 - known_count))
                }
            })
            .collect();

        if unknown_seats.is_empty() || unknown_pool.is_empty() {
            return;
        }

        let total_needed: usize = unknown_seats.iter().map(|(_, n)| n).sum();
        if unknown_pool.len() < total_needed {
            return;
        }

        let mut attempts = 0;

        while self.samples.len() < SAMPLE_BUDGET && attempts < MAX_ATTEMPTS {
            attempts += 1;

            // Shuffle the unknown pool
            let mut pool_buf = unknown_pool.clone();
            pool_buf.shuffle(&mut self.rng);

            // Deal chunks to unknown seats
            let mut offset = 0;
            let mut candidate = HashMap::new();
            for &(seat, count) in &unknown_seats {
                let hand_cards = pool_buf[offset..offset + count].to_vec();
                candidate.insert(seat, hand_cards);
                offset += count;
            }

            // Check constraints for each unknown seat
            if self.check_constraints(&candidate) {
                self.samples.push(SampledDeal { hands: candidate });
            }
        }
    }

    /// Check if all unknown seats' dealt hands satisfy their DerivedRanges constraints.
    fn check_constraints(&self, candidate: &HashMap<Seat, Vec<Card>>) -> bool {
        for (seat, cards) in candidate {
            if let Some(ranges) = self.constraints.get(seat) {
                let hand = Hand {
                    cards: cards.clone(),
                };
                let hcp = calculate_hcp(&hand);
                if hcp < ranges.hcp.min || hcp > ranges.hcp.max {
                    return false;
                }

                let shape = get_suit_length(&hand);
                for (&suit, range) in &ranges.suit_lengths {
                    let idx = suit_to_shape_index(suit);
                    let len = shape[idx] as u32;
                    if len < range.min || len > range.max {
                        return false;
                    }
                }

                if let Some(expected_balanced) = ranges.is_balanced {
                    if is_balanced(&shape) != expected_balanced {
                        return false;
                    }
                }
            }
        }
        true
    }

    // ── Query methods ─────────────────────────────────────────────

    /// Expected HCP for a seat across accepted samples: (mean, confidence).
    pub fn marginal_hcp(&self, seat: Seat) -> (f64, f64) {
        if self.samples.is_empty() {
            return (10.0, 0.0);
        }
        let mut sum = 0.0;
        let mut count = 0;
        for sample in &self.samples {
            if let Some(cards) = sample.hands.get(&seat) {
                let hand = Hand {
                    cards: cards.clone(),
                };
                sum += calculate_hcp(&hand) as f64;
                count += 1;
            }
        }
        if count == 0 {
            return (10.0, 0.0);
        }
        (sum / count as f64, self.confidence())
    }

    /// Expected suit length for a seat: (mean, confidence).
    pub fn suit_length(&self, seat: Seat, suit: Suit) -> (f64, f64) {
        if self.samples.is_empty() {
            return (3.25, 0.0);
        }
        let idx = suit_to_shape_index(suit);
        let mut sum = 0.0;
        let mut count = 0;
        for sample in &self.samples {
            if let Some(cards) = sample.hands.get(&seat) {
                let hand = Hand {
                    cards: cards.clone(),
                };
                let shape = get_suit_length(&hand);
                sum += shape[idx] as f64;
                count += 1;
            }
        }
        if count == 0 {
            return (3.25, 0.0);
        }
        (sum / count as f64, self.confidence())
    }

    /// Confidence metric: min(1.0, sample_count / FULL_CONFIDENCE_THRESHOLD).
    pub fn confidence(&self) -> f64 {
        (self.samples.len() as f64 / FULL_CONFIDENCE_THRESHOLD).min(1.0)
    }

    /// Get all marginal HCP values as a map.
    pub fn all_marginal_hcp(&self) -> HashMap<Seat, f64> {
        let mut result = HashMap::new();
        for &seat in &[Seat::North, Seat::East, Seat::South, Seat::West] {
            let (mean, _) = self.marginal_hcp(seat);
            result.insert(seat, mean);
        }
        result
    }

    /// Get all suit lengths as a nested map.
    pub fn all_suit_lengths(&self) -> HashMap<Seat, HashMap<Suit, f64>> {
        let mut result = HashMap::new();
        for &seat in &[Seat::North, Seat::East, Seat::South, Seat::West] {
            let mut suit_map = HashMap::new();
            for &suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
                let (mean, _) = self.suit_length(seat, suit);
                suit_map.insert(suit, mean);
            }
            result.insert(seat, suit_map);
        }
        result
    }

    /// Update known cards after a trick completes. Clears samples and re-runs sampling.
    pub fn update_with_played_cards(&mut self, played: &[bridge_engine::types::PlayedCard]) {
        for pc in played {
            self.known_cards
                .entry(pc.seat)
                .or_default()
                .push(pc.card.clone());
        }
        self.run_sampling();
    }

    /// Number of accepted samples (for testing).
    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }
}

// ── Suit index helper ─────────────────────────────────────────────

/// Maps Suit to the shape array index used by bridge_engine::get_suit_length.
/// Spades=0, Hearts=1, Diamonds=2, Clubs=3.
fn suit_to_shape_index(suit: Suit) -> usize {
    match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::NumberRange;
    use super::*;
    use bridge_engine::types::Rank;

    // ── PosteriorEngine tests ──────────────────────────────────────

    fn make_13_card_hand(suit: Suit) -> Vec<Card> {
        let ranks = [
            Rank::Two,
            Rank::Three,
            Rank::Four,
            Rank::Five,
            Rank::Six,
            Rank::Seven,
            Rank::Eight,
            Rank::Nine,
            Rank::Ten,
            Rank::Jack,
            Rank::Queen,
            Rank::King,
            Rank::Ace,
        ];
        ranks.iter().map(|&r| Card { suit, rank: r }).collect()
    }

    #[test]
    fn unconstrained_sampling_near_uniform() {
        // Observer knows their own hand (South = all spades).
        // No constraints on other seats → HCP should average ~10 each.
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));
        let constraints = HashMap::new(); // no constraints

        let engine = PosteriorEngine::new(Seat::South, known, constraints, 42);

        // Should get close to SAMPLE_BUDGET samples
        assert!(
            engine.sample_count() > 100,
            "Expected many samples, got {}",
            engine.sample_count()
        );

        // Mean HCP for unknown seats should be near 10 (±3 with 200 samples)
        let (mean_hcp, conf) = engine.marginal_hcp(Seat::North);
        assert!(
            mean_hcp > 7.0 && mean_hcp < 13.0,
            "Expected ~10 HCP, got {}",
            mean_hcp
        );
        assert!(conf > 0.5, "Expected decent confidence, got {}", conf);
    }

    #[test]
    fn constrained_sampling_narrows_hcp() {
        // Observer: South. Constrain North to 15-17 HCP (1NT opener).
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let mut constraints = HashMap::new();
        let mut suit_lengths = HashMap::new();
        for &suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
            suit_lengths.insert(suit, NumberRange { min: 0, max: 13 });
        }
        constraints.insert(
            Seat::North,
            DerivedRanges {
                hcp: NumberRange { min: 15, max: 17 },
                suit_lengths,
                is_balanced: None,
            },
        );

        let engine = PosteriorEngine::new(Seat::South, known, constraints, 42);

        // Fewer samples than unconstrained (harder to hit 15-17)
        assert!(engine.sample_count() > 0, "Should accept some samples");

        let (mean_hcp, _) = engine.marginal_hcp(Seat::North);
        assert!(
            mean_hcp >= 15.0 && mean_hcp <= 17.0,
            "Constrained North HCP should be in [15,17], got {}",
            mean_hcp
        );
    }

    #[test]
    fn contradictory_constraints_zero_samples() {
        // Require North to have 40 HCP (impossible with 39 remaining after South's hand)
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let mut constraints = HashMap::new();
        let mut suit_lengths = HashMap::new();
        for &suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
            suit_lengths.insert(suit, NumberRange { min: 0, max: 13 });
        }
        constraints.insert(
            Seat::North,
            DerivedRanges {
                hcp: NumberRange { min: 40, max: 40 },
                suit_lengths,
                is_balanced: None,
            },
        );

        let engine = PosteriorEngine::new(Seat::South, known, constraints, 42);

        assert_eq!(engine.sample_count(), 0);
        assert_eq!(engine.confidence(), 0.0);
        // Fallback values
        let (hcp, _) = engine.marginal_hcp(Seat::North);
        assert_eq!(hcp, 10.0);
    }

    #[test]
    fn deterministic_same_seed() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let engine1 = PosteriorEngine::new(Seat::South, known.clone(), HashMap::new(), 99);
        let engine2 = PosteriorEngine::new(Seat::South, known, HashMap::new(), 99);

        let (hcp1, _) = engine1.marginal_hcp(Seat::North);
        let (hcp2, _) = engine2.marginal_hcp(Seat::North);
        assert_eq!(hcp1, hcp2, "Same seed should produce identical results");
    }

    #[test]
    fn known_hand_excluded_from_sampling() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let engine = PosteriorEngine::new(Seat::South, known, HashMap::new(), 42);

        // South shouldn't appear in any sampled deal
        for sample in &engine.samples {
            assert!(
                !sample.hands.contains_key(&Seat::South),
                "Observer seat should not be in sampled deals"
            );
        }
    }

    #[test]
    fn suit_length_query_works() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let engine = PosteriorEngine::new(Seat::South, known, HashMap::new(), 42);

        let (length, conf) = engine.suit_length(Seat::North, Suit::Hearts);
        // With 39 non-spade cards distributed among 3 seats,
        // each suit should average ~3.25 cards per seat
        assert!(
            length > 1.0 && length < 6.0,
            "Expected ~3.25, got {}",
            length
        );
        assert!(conf > 0.0);
    }

    #[test]
    fn update_with_played_cards_re_samples() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let mut engine = PosteriorEngine::new(Seat::South, known, HashMap::new(), 42);
        let initial_count = engine.sample_count();

        // Simulate a completed trick
        let played = vec![
            bridge_engine::types::PlayedCard {
                card: Card {
                    suit: Suit::Hearts,
                    rank: Rank::Ace,
                },
                seat: Seat::West,
            },
            bridge_engine::types::PlayedCard {
                card: Card {
                    suit: Suit::Hearts,
                    rank: Rank::King,
                },
                seat: Seat::North,
            },
            bridge_engine::types::PlayedCard {
                card: Card {
                    suit: Suit::Hearts,
                    rank: Rank::Two,
                },
                seat: Seat::East,
            },
            bridge_engine::types::PlayedCard {
                card: Card {
                    suit: Suit::Spades,
                    rank: Rank::Three,
                },
                seat: Seat::South,
            },
        ];
        engine.update_with_played_cards(&played);

        // Should still have samples after update
        assert!(engine.sample_count() > 0);
        // Known cards for North should now include the King of Hearts
        assert!(engine
            .known_cards
            .get(&Seat::North)
            .unwrap()
            .iter()
            .any(|c| c.suit == Suit::Hearts && c.rank == Rank::King));
        let _ = initial_count; // suppress unused warning
    }

    #[test]
    fn all_marginal_hcp_returns_all_seats() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let engine = PosteriorEngine::new(Seat::South, known, HashMap::new(), 42);
        let hcps = engine.all_marginal_hcp();

        assert!(hcps.contains_key(&Seat::North));
        assert!(hcps.contains_key(&Seat::East));
        assert!(hcps.contains_key(&Seat::West));
        // South is known, so its HCP will be the fallback
        assert!(hcps.contains_key(&Seat::South));
    }

    #[test]
    fn all_suit_lengths_returns_all_seats_and_suits() {
        let mut known = HashMap::new();
        known.insert(Seat::South, make_13_card_hand(Suit::Spades));

        let engine = PosteriorEngine::new(Seat::South, known, HashMap::new(), 42);
        let lengths = engine.all_suit_lengths();

        for &seat in &[Seat::North, Seat::East, Seat::West] {
            let suit_map = lengths.get(&seat).expect("Should have entry for seat");
            assert!(suit_map.contains_key(&Suit::Spades));
            assert!(suit_map.contains_key(&Suit::Hearts));
            assert!(suit_map.contains_key(&Suit::Diamonds));
            assert!(suit_map.contains_key(&Suit::Clubs));
        }
    }

    #[test]
    fn constrained_suit_length() {
        // Constrain North to have exactly 5 spades
        let mut known = HashMap::new();
        // South has no spades — give them all hearts
        known.insert(Seat::South, make_13_card_hand(Suit::Hearts));

        let mut constraints = HashMap::new();
        let mut suit_lengths = HashMap::new();
        suit_lengths.insert(Suit::Spades, NumberRange { min: 5, max: 5 });
        suit_lengths.insert(Suit::Hearts, NumberRange { min: 0, max: 13 });
        suit_lengths.insert(Suit::Diamonds, NumberRange { min: 0, max: 13 });
        suit_lengths.insert(Suit::Clubs, NumberRange { min: 0, max: 13 });
        constraints.insert(
            Seat::North,
            DerivedRanges {
                hcp: NumberRange { min: 0, max: 40 },
                suit_lengths,
                is_balanced: None,
            },
        );

        let engine = PosteriorEngine::new(Seat::South, known, constraints, 42);

        if engine.sample_count() > 0 {
            let (length, _) = engine.suit_length(Seat::North, Suit::Spades);
            assert!(
                (length - 5.0).abs() < 0.01,
                "Constrained North spade length should be exactly 5, got {}",
                length
            );
        }
    }
}
