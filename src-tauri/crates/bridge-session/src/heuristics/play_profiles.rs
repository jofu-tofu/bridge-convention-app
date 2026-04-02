//! Play profiles: difficulty levels controlling AI card play behavior.
//!
//! Four named profiles (beginner, club-player, expert, world-class) configure
//! which heuristics to use and how. Expert/world-class currently fall back to
//! the heuristic chain (MC+DDS deferred to integration phase).

use serde::{Deserialize, Serialize};

use super::play::{
    CoverHonorHeuristic, DiscardHeuristic, FourthHandHeuristic,
    MidGameLeadHeuristic, OpeningLeadHeuristic, SecondHandLowHeuristic, ThirdHandHighHeuristic,
    TrumpManagementHeuristic,
};
use super::play_types::{PlayContext, PlayHeuristic, PlayResult};

// ── Profile identity ────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PlayProfileId {
    #[serde(rename = "beginner")]
    Beginner,
    #[serde(rename = "club-player")]
    ClubPlayer,
    #[serde(rename = "expert")]
    Expert,
    #[serde(rename = "world-class")]
    WorldClass,
}

// ── Profile configuration ───────────────────────────────────────────

/// Configuration for a play difficulty profile.
#[derive(Debug, Clone)]
pub struct PlayProfile {
    pub id: PlayProfileId,
    pub name: &'static str,
    pub description: &'static str,
    /// Probability (0.0-0.3) of skipping eligible heuristics (beginner errors).
    pub heuristic_skip_rate: f64,
    /// Heuristic names eligible for random skip.
    pub skippable_heuristics: &'static [&'static str],
    /// Whether L1 inference-enhanced heuristics are active.
    pub use_inferences: bool,
    /// Blur (0.0-0.5) on probability estimates for inference decisions.
    pub inference_noise: f64,
    /// Whether L2 posterior queries are active.
    pub use_posterior: bool,
    /// Whether to track played cards for distribution updates.
    pub use_card_counting: bool,
}

// ── Profile constants ───────────────────────────────────────────────

pub const BEGINNER_PROFILE: PlayProfile = PlayProfile {
    id: PlayProfileId::Beginner,
    name: "Beginner",
    description: "Follows maxims mechanically. Occasionally misses correct technique.",
    heuristic_skip_rate: 0.15,
    skippable_heuristics: &["cover-honor-with-honor", "trump-management"],
    use_inferences: false,
    inference_noise: 0.0,
    use_posterior: false,
    use_card_counting: false,
};

pub const CLUB_PLAYER_PROFILE: PlayProfile = PlayProfile {
    id: PlayProfileId::ClubPlayer,
    name: "Club Player",
    description:
        "Remembers the auction, counts cards, tracks voids, exploits restricted choice.",
    heuristic_skip_rate: 0.0,
    skippable_heuristics: &[],
    use_inferences: true,
    inference_noise: 0.25,
    use_posterior: false,
    use_card_counting: true,
};

pub const EXPERT_PROFILE: PlayProfile = PlayProfile {
    id: PlayProfileId::Expert,
    name: "Expert",
    description: "Monte Carlo + DDS solving with void tracking. No auction belief filtering.",
    heuristic_skip_rate: 0.0,
    skippable_heuristics: &[],
    use_inferences: true,
    inference_noise: 0.0,
    use_posterior: false,
    use_card_counting: true,
};

pub const WORLD_CLASS_PROFILE: PlayProfile = PlayProfile {
    id: PlayProfileId::WorldClass,
    name: "World Class",
    description:
        "Monte Carlo sampling + DDS solving. Plays optimally given available information.",
    heuristic_skip_rate: 0.0,
    skippable_heuristics: &[],
    use_inferences: true,
    inference_noise: 0.0,
    use_posterior: true,
    use_card_counting: true,
};

/// Look up a profile by ID.
pub fn get_profile(id: PlayProfileId) -> &'static PlayProfile {
    match id {
        PlayProfileId::Beginner => &BEGINNER_PROFILE,
        PlayProfileId::ClubPlayer => &CLUB_PLAYER_PROFILE,
        PlayProfileId::Expert => &EXPERT_PROFILE,
        PlayProfileId::WorldClass => &WORLD_CLASS_PROFILE,
    }
}

// ── Profile-based play strategy ─────────────────────────────────────

/// Create a play strategy that uses the given profile's configuration.
///
/// For beginner: runs the heuristic chain but randomly skips eligible heuristics.
/// For club-player/expert/world-class: runs the full heuristic chain (MC+DDS deferred).
pub fn suggest_play_with_profile(
    ctx: &PlayContext,
    profile: &PlayProfile,
    rng: &mut impl rand::Rng,
) -> PlayResult {
    assert!(
        !ctx.legal_plays.is_empty(),
        "No legal plays available"
    );

    // Build the heuristic chain
    let heuristics: Vec<Box<dyn PlayHeuristic>> = vec![
        Box::new(OpeningLeadHeuristic),
        Box::new(MidGameLeadHeuristic),
        Box::new(SecondHandLowHeuristic),
        Box::new(ThirdHandHighHeuristic),
        Box::new(FourthHandHeuristic),
        Box::new(CoverHonorHeuristic),
        Box::new(TrumpManagementHeuristic),
        Box::new(DiscardHeuristic),
    ];

    for h in &heuristics {
        // Beginner: randomly skip eligible heuristics
        if profile.heuristic_skip_rate > 0.0
            && profile
                .skippable_heuristics
                .contains(&h.name())
        {
            let roll: f64 = rng.gen();
            if roll < profile.heuristic_skip_rate {
                continue;
            }
        }

        if let Some(card) = h.apply(ctx) {
            if ctx
                .legal_plays
                .iter()
                .any(|c| c.suit == card.suit && c.rank == card.rank)
            {
                return PlayResult {
                    card,
                    reason: h.name().to_string(),
                };
            }
        }
    }

    // Fallback: lowest legal card
    let sorted = super::play_types::sort_by_rank_asc(&ctx.legal_plays);
    let fallback = sorted.into_iter().next().unwrap_or_else(|| ctx.legal_plays[0].clone());
    PlayResult {
        card: fallback,
        reason: "default-lowest".to_string(),
    }
}

/// Convenience: suggest a play using the default (no-skip) heuristic chain.
/// Equivalent to expert/world-class without MC+DDS.
pub fn suggest_play_default(ctx: &PlayContext) -> PlayResult {
    super::play::suggest_play(ctx)
}

/// Convenience: suggest a random play with a given seed.
pub fn suggest_random_play(ctx: &PlayContext, seed: u64) -> PlayResult {
    let strategy = super::random_play::RandomPlayStrategy::new(seed);
    strategy.suggest(ctx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Card, Contract, Hand, PlayedCard, Rank, Seat, Suit};
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

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
    fn profile_lookup() {
        assert_eq!(get_profile(PlayProfileId::Beginner).name, "Beginner");
        assert_eq!(get_profile(PlayProfileId::ClubPlayer).name, "Club Player");
        assert_eq!(get_profile(PlayProfileId::Expert).name, "Expert");
        assert_eq!(get_profile(PlayProfileId::WorldClass).name, "World Class");
    }

    #[test]
    fn beginner_skip_rate_is_nonzero() {
        assert!(BEGINNER_PROFILE.heuristic_skip_rate > 0.0);
        assert!(!BEGINNER_PROFILE.skippable_heuristics.is_empty());
    }

    #[test]
    fn expert_profiles_have_no_skip() {
        assert_eq!(EXPERT_PROFILE.heuristic_skip_rate, 0.0);
        assert_eq!(WORLD_CLASS_PROFILE.heuristic_skip_rate, 0.0);
    }

    #[test]
    fn suggest_with_profile_returns_legal_card() {
        let cards = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::Three),
        ];
        let legal = cards.clone();
        let ctx = PlayContext {
            hand: Hand {
                cards,
            },
            current_trick: vec![played(Seat::North, Suit::Diamonds, Rank::Ten)],
            previous_tricks: vec![],
            contract: nt_contract(),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal.clone(),
            dummy_hand: None,
            beliefs: None,
        };

        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let result = suggest_play_with_profile(&ctx, &BEGINNER_PROFILE, &mut rng);
        assert!(legal
            .iter()
            .any(|c| c.suit == result.card.suit && c.rank == result.card.rank));
    }

    #[test]
    fn beginner_sometimes_skips_cover_honor() {
        // Set up a scenario where cover-honor would normally fire
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let legal = cards.clone();
        let ctx = PlayContext {
            hand: Hand {
                cards,
            },
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: nt_contract(),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal.clone(),
            dummy_hand: None,
            beliefs: None,
        };

        // Run many times with beginner profile -- should sometimes skip cover-honor
        let mut covered = 0;
        let mut not_covered = 0;
        for seed in 0..200 {
            let mut rng = ChaCha8Rng::seed_from_u64(seed);
            let result = suggest_play_with_profile(&ctx, &BEGINNER_PROFILE, &mut rng);
            if result.card.rank == Rank::King {
                covered += 1;
            } else {
                not_covered += 1;
            }
        }
        // With 15% skip rate, we expect some non-covers
        assert!(covered > 0, "Should sometimes cover");
        assert!(not_covered > 0, "Should sometimes skip covering (beginner error)");
    }

    #[test]
    fn expert_never_skips() {
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let legal = cards.clone();
        let ctx = PlayContext {
            hand: Hand {
                cards,
            },
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: nt_contract(),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
            beliefs: None,
        };

        // Expert should always cover
        for seed in 0..50 {
            let mut rng = ChaCha8Rng::seed_from_u64(seed);
            let result = suggest_play_with_profile(&ctx, &EXPERT_PROFILE, &mut rng);
            assert_eq!(
                result.card.rank,
                Rank::King,
                "Expert should always cover honor"
            );
        }
    }

    #[test]
    fn profile_id_serde_roundtrip() {
        let ids = vec![
            PlayProfileId::Beginner,
            PlayProfileId::ClubPlayer,
            PlayProfileId::Expert,
            PlayProfileId::WorldClass,
        ];
        for id in ids {
            let json = serde_json::to_string(&id).unwrap();
            let back: PlayProfileId = serde_json::from_str(&json).unwrap();
            assert_eq!(back, id);
        }
    }

    #[test]
    fn profile_id_serde_values() {
        assert_eq!(
            serde_json::to_string(&PlayProfileId::Beginner).unwrap(),
            "\"beginner\""
        );
        assert_eq!(
            serde_json::to_string(&PlayProfileId::ClubPlayer).unwrap(),
            "\"club-player\""
        );
        assert_eq!(
            serde_json::to_string(&PlayProfileId::Expert).unwrap(),
            "\"expert\""
        );
        assert_eq!(
            serde_json::to_string(&PlayProfileId::WorldClass).unwrap(),
            "\"world-class\""
        );
    }
}
