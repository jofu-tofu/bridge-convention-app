//! Drill startup orchestration — deal generation, strategy setup, and
//! inference engine creation.
//!
//! Ported from TS `src/session/start-drill.ts`.

use bridge_engine::deal_generator::generate_deal;
use bridge_engine::types::{
    Auction, AuctionEntry, Deal, DealConstraints, Seat, SeatConstraint, Vulnerability,
};

use crate::inference::inference_engine::InferenceEngine;
use crate::inference::natural_inference::NaturalInferenceProvider;
use crate::inference::types::InferenceConfig;
use crate::types::{
    DrillTuning, OpponentMode, PlayPreference, PracticeFocus, PracticeMode, PracticeRole,
    VulnerabilityDistribution,
};

use super::practice_focus::{derive_initial_auction, derive_practice_focus};

use super::config_factory::DrillConfig;

// ── DrillBundle ─────────────────────────────────────────────────────

/// Result of `start_drill()` — everything needed to begin a new drill session.
pub struct DrillBundle {
    pub deal: Deal,
    pub config: DrillConfig,
    pub initial_auction: Option<Auction>,
    pub ns_inference_engine: Option<InferenceEngine>,
    pub ew_inference_engine: Option<InferenceEngine>,
    pub is_off_convention: bool,
    pub practice_mode: PracticeMode,
    pub practice_focus: PracticeFocus,
    pub play_preference: PlayPreference,
    pub resolved_role: PracticeRole,
}

// ── Rotation utilities ──────────────────────────────────────────────

/// 180-degree table rotation: N<->S, E<->W.
pub fn rotate_seat_180(seat: Seat) -> Seat {
    match seat {
        Seat::North => Seat::South,
        Seat::South => Seat::North,
        Seat::East => Seat::West,
        Seat::West => Seat::East,
    }
}

/// Rotate deal constraints for a new dealer, swapping seat assignments.
pub fn rotate_deal_constraints(base: &DealConstraints, new_dealer: Seat) -> DealConstraints {
    if base.dealer == Some(new_dealer) || base.dealer.is_none() {
        return base.clone();
    }
    DealConstraints {
        seats: base
            .seats
            .iter()
            .map(|sc| SeatConstraint {
                seat: rotate_seat_180(sc.seat),
                ..sc.clone()
            })
            .collect(),
        dealer: Some(new_dealer),
        vulnerability: base.vulnerability,
        max_attempts: base.max_attempts,
        seed: base.seed,
    }
}

/// Rotate an auction's entries (swap seats 180 degrees).
pub fn rotate_auction(auction: &Auction) -> Auction {
    Auction {
        entries: auction
            .entries
            .iter()
            .map(|e| AuctionEntry {
                seat: rotate_seat_180(e.seat),
                call: e.call.clone(),
            })
            .collect(),
        is_complete: auction.is_complete,
    }
}

// ── Vulnerability selection ─────────────────────────────────────────

/// Pick a Vulnerability from a weighted distribution.
/// "ours"/"theirs" are resolved relative to the user's partnership.
pub fn pick_vulnerability(
    dist: &VulnerabilityDistribution,
    user_seat: Seat,
    roll: f64,
) -> Vulnerability {
    let total = dist.none + dist.ours + dist.theirs + dist.both;
    if total <= 0.0 {
        return Vulnerability::None;
    }
    let target = roll * total;
    let user_is_ns = user_seat == Seat::North || user_seat == Seat::South;

    let mut acc = dist.none;
    if target < acc {
        return Vulnerability::None;
    }

    acc += dist.ours;
    if target < acc {
        return if user_is_ns {
            Vulnerability::NorthSouth
        } else {
            Vulnerability::EastWest
        };
    }

    acc += dist.theirs;
    if target < acc {
        return if user_is_ns {
            Vulnerability::EastWest
        } else {
            Vulnerability::NorthSouth
        };
    }

    Vulnerability::Both
}

// ── Drill options ───────────────────────────────────────────────────

/// Options for starting a drill.
pub struct StartDrillOptions {
    pub practice_mode: PracticeMode,
    pub practice_role: PracticeRole,
    pub play_preference: Option<PlayPreference>,
    pub opponent_mode: OpponentMode,
    pub tuning: DrillTuning,
    pub seed: Option<u64>,
    pub target_module_id: Option<String>,
    pub bundle_member_ids: Option<Vec<String>>,
    pub bundle_deal_constraints: Option<DealConstraints>,
}

impl Default for StartDrillOptions {
    fn default() -> Self {
        Self {
            practice_mode: PracticeMode::DecisionDrill,
            practice_role: PracticeRole::Responder,
            play_preference: None,
            opponent_mode: OpponentMode::Natural,
            tuning: DrillTuning::default(),
            seed: None,
            target_module_id: None,
            bundle_member_ids: None,
            bundle_deal_constraints: None,
        }
    }
}

// ── Convention config (simplified) ──────────────────────────────────

/// Simplified convention configuration for deal generation.
/// In the full system, this comes from the convention registry.
/// Here we define the minimal struct needed by start_drill().
pub struct ConventionConfig {
    pub id: String,
    pub deal_constraints: DealConstraints,
    pub allowed_dealers: Option<Vec<Seat>>,
    pub off_convention_constraints: Option<DealConstraints>,
}

// ── start_drill ─────────────────────────────────────────────────────

/// Orchestrate a new drill session: generate a deal, set up strategies,
/// create inference engines, and return a DrillBundle.
///
/// This is a simplified port that works with the Rust engine directly
/// (no EnginePort indirection, no async).
pub fn start_drill(
    convention: &ConventionConfig,
    user_seat: Seat,
    config: DrillConfig,
    options: &StartDrillOptions,
    rng: &mut dyn FnMut() -> f64,
) -> Result<DrillBundle, String> {
    let practice_mode = options.practice_mode;

    // ── Role resolution ─────────────────────────────────────────
    let effective_role = options.practice_role;
    let resolved_role = match effective_role {
        PracticeRole::Both => {
            let roll = rng();
            if roll < 0.5 {
                PracticeRole::Opener
            } else {
                PracticeRole::Responder
            }
        }
        other => other,
    };

    // ── Dealer randomization ────────────────────────────────────
    let mut resolved_constraints = convention.deal_constraints.clone();
    let mut dealer_rotated = false;

    if let Some(ref allowed_dealers) = convention.allowed_dealers {
        if allowed_dealers.len() > 1 {
            let roll = rng();
            let idx = (roll * allowed_dealers.len() as f64) as usize;
            let idx = idx.min(allowed_dealers.len() - 1);
            let chosen_dealer = allowed_dealers[idx];
            if Some(chosen_dealer) != convention.deal_constraints.dealer {
                resolved_constraints =
                    rotate_deal_constraints(&convention.deal_constraints, chosen_dealer);
                dealer_rotated = true;
            }
        }
    }

    // ── Vulnerability ───────────────────────────────────────────
    let vul_roll = rng();
    let vulnerability = pick_vulnerability(
        &options.tuning.vulnerability_distribution,
        user_seat,
        vul_roll,
    );

    // ── Off-convention ──────────────────────────────────────────
    let mut is_off_convention = false;
    if options.tuning.include_off_convention == Some(true) {
        let off_rate = options.tuning.off_convention_rate.unwrap_or(0.3);
        let off_roll = rng();
        if off_roll < off_rate {
            if let Some(ref off_constraints) = convention.off_convention_constraints {
                resolved_constraints = if dealer_rotated {
                    rotate_deal_constraints(
                        off_constraints,
                        resolved_constraints.dealer.unwrap_or(Seat::North),
                    )
                } else {
                    off_constraints.clone()
                };
                is_off_convention = true;
            }
        }
    }

    // ── Role-based constraint swapping ──────────────────────────
    if resolved_role == PracticeRole::Opener {
        if resolved_constraints.dealer.is_none() {
            resolved_constraints = DealConstraints {
                dealer: Some(user_seat),
                seats: resolved_constraints
                    .seats
                    .iter()
                    .map(|sc| SeatConstraint {
                        seat: rotate_seat_180(sc.seat),
                        ..sc.clone()
                    })
                    .collect(),
                ..resolved_constraints
            };
        } else if resolved_constraints.dealer != Some(user_seat) {
            resolved_constraints = rotate_deal_constraints(&resolved_constraints, user_seat);
        }
    }

    // ── Deal generation ─────────────────────────────────────────
    let constraints = DealConstraints {
        vulnerability: Some(vulnerability),
        seed: options.seed,
        ..resolved_constraints
    };

    let deal_result =
        generate_deal(&constraints).map_err(|e| format!("Deal generation failed: {e}"))?;

    // ── Inference engines ───────────────────────────────────────
    let ns_inference_engine = Some(InferenceEngine::new(
        InferenceConfig {
            own_partnership: Box::new(NaturalInferenceProvider::default_sayc()),
            opponent_partnership: Box::new(NaturalInferenceProvider::default_sayc()),
        },
        Seat::North,
    ));

    let ew_inference_engine = Some(InferenceEngine::new(
        InferenceConfig {
            own_partnership: Box::new(NaturalInferenceProvider::default_sayc()),
            opponent_partnership: Box::new(NaturalInferenceProvider::default_sayc()),
        },
        Seat::East,
    ));

    // ── Play preference ─────────────────────────────────────────
    let default_play_preference = match practice_mode {
        PracticeMode::DecisionDrill => PlayPreference::Skip,
        _ => PlayPreference::Prompt,
    };
    let play_preference = options.play_preference.unwrap_or(default_play_preference);

    // ── Practice focus + initial auction ────────────────────────
    let base_module_ids: &[&str] = &["natural-bids", "stayman", "jacoby-transfers", "blackwood"];

    // Practice focus (gated on target module)
    let practice_focus = if let Some(ref target_id) = options.target_module_id {
        let member_ids = options.bundle_member_ids.as_deref().unwrap_or(&[]);
        derive_practice_focus(member_ids, target_id, base_module_ids)
    } else {
        PracticeFocus::default()
    };

    // Initial auction (always derived from convention constraints)
    let dealer = deal_result.deal.dealer;
    let initial_auction = derive_initial_auction(
        resolved_role,
        dealer,
        Some(&convention.deal_constraints),
        Some(&deal_result.deal),
    );

    Ok(DrillBundle {
        deal: deal_result.deal,
        config,
        initial_auction,
        ns_inference_engine,
        ew_inference_engine,
        is_off_convention,
        practice_mode,
        practice_focus,
        play_preference,
        resolved_role,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{BidSuit, Call, Suit};
    use std::collections::HashMap;

    // ── Rotation tests ──────────────────────────────────────────

    #[test]
    fn rotate_seat_180_all_seats() {
        assert_eq!(rotate_seat_180(Seat::North), Seat::South);
        assert_eq!(rotate_seat_180(Seat::South), Seat::North);
        assert_eq!(rotate_seat_180(Seat::East), Seat::West);
        assert_eq!(rotate_seat_180(Seat::West), Seat::East);
    }

    #[test]
    fn rotate_seat_180_involution() {
        for &seat in &bridge_engine::SEATS {
            assert_eq!(rotate_seat_180(rotate_seat_180(seat)), seat);
        }
    }

    #[test]
    fn rotate_constraints_noop_if_same_dealer() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
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
        let rotated = rotate_deal_constraints(&constraints, Seat::North);
        assert_eq!(rotated.dealer, Some(Seat::North));
        assert_eq!(rotated.seats[0].seat, Seat::South);
    }

    #[test]
    fn rotate_constraints_swaps_seats() {
        let constraints = DealConstraints {
            seats: vec![
                SeatConstraint {
                    seat: Seat::South,
                    min_hcp: Some(15),
                    max_hcp: Some(17),
                    balanced: None,
                    min_length: None,
                    max_length: None,
                    min_length_any: None,
                },
                SeatConstraint {
                    seat: Seat::North,
                    min_hcp: Some(6),
                    max_hcp: Some(10),
                    balanced: None,
                    min_length: None,
                    max_length: None,
                    min_length_any: None,
                },
            ],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };
        let rotated = rotate_deal_constraints(&constraints, Seat::South);
        assert_eq!(rotated.dealer, Some(Seat::South));
        // Seats should be swapped: South -> North, North -> South
        assert_eq!(rotated.seats[0].seat, Seat::North);
        assert_eq!(rotated.seats[0].min_hcp, Some(15));
        assert_eq!(rotated.seats[1].seat, Seat::South);
        assert_eq!(rotated.seats[1].min_hcp, Some(6));
    }

    #[test]
    fn rotate_constraints_noop_if_no_dealer() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
                min_hcp: Some(10),
                max_hcp: None,
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            dealer: None,
            vulnerability: None,
            max_attempts: None,
            seed: None,
        };
        let rotated = rotate_deal_constraints(&constraints, Seat::North);
        // No dealer = noop
        assert_eq!(rotated.seats[0].seat, Seat::South);
    }

    #[test]
    fn rotate_auction_swaps_seats() {
        let auction = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: bridge_engine::types::Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: bridge_engine::types::Call::Bid {
                        level: 1,
                        strain: bridge_engine::types::BidSuit::Clubs,
                    },
                },
            ],
            is_complete: false,
        };
        let rotated = rotate_auction(&auction);
        assert_eq!(rotated.entries[0].seat, Seat::South);
        assert_eq!(rotated.entries[1].seat, Seat::West);
        assert!(!rotated.is_complete);
    }

    // ── Vulnerability tests ─────────────────────────────────────

    #[test]
    fn pick_vulnerability_none_only() {
        let dist = VulnerabilityDistribution {
            none: 1.0,
            ours: 0.0,
            theirs: 0.0,
            both: 0.0,
        };
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.5),
            Vulnerability::None
        );
    }

    #[test]
    fn pick_vulnerability_all_equal() {
        let dist = VulnerabilityDistribution {
            none: 1.0,
            ours: 1.0,
            theirs: 1.0,
            both: 1.0,
        };
        // roll=0.0 -> None
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.0),
            Vulnerability::None
        );
        // roll close to 0.25 -> still None (boundary)
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.24),
            Vulnerability::None
        );
        // roll=0.3 -> ours (NS for South)
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.3),
            Vulnerability::NorthSouth
        );
        // roll=0.55 -> theirs (EW for South)
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.55),
            Vulnerability::EastWest
        );
        // roll=0.9 -> both
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.9),
            Vulnerability::Both
        );
    }

    #[test]
    fn pick_vulnerability_ew_user() {
        let dist = VulnerabilityDistribution {
            none: 0.0,
            ours: 1.0,
            theirs: 0.0,
            both: 0.0,
        };
        // "ours" for East user = EW
        assert_eq!(
            pick_vulnerability(&dist, Seat::East, 0.5),
            Vulnerability::EastWest
        );
    }

    #[test]
    fn pick_vulnerability_zero_total() {
        let dist = VulnerabilityDistribution {
            none: 0.0,
            ours: 0.0,
            theirs: 0.0,
            both: 0.0,
        };
        assert_eq!(
            pick_vulnerability(&dist, Seat::South, 0.5),
            Vulnerability::None
        );
    }

    // ── start_drill tests ───────────────────────────────────────

    #[test]
    fn start_drill_basic() {
        let convention = ConventionConfig {
            id: "test".to_string(),
            deal_constraints: DealConstraints {
                seats: vec![],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: None,
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let mut rng_val = 0.5_f64;
        let mut rng = || {
            let v = rng_val;
            rng_val += 0.1;
            if rng_val > 1.0 {
                rng_val = 0.0;
            }
            v
        };

        let options = StartDrillOptions {
            seed: Some(42),
            ..Default::default()
        };

        let bundle = start_drill(&convention, Seat::South, config, &options, &mut rng).unwrap();
        assert!(!bundle.deal.hands.is_empty());
        assert_eq!(bundle.practice_mode, PracticeMode::DecisionDrill);
        assert_eq!(bundle.play_preference, PlayPreference::Skip);
        assert!(!bundle.is_off_convention);
    }

    #[test]
    fn start_drill_opener_role_swaps_dealer() {
        let convention = ConventionConfig {
            id: "test".to_string(),
            deal_constraints: DealConstraints {
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
                max_attempts: Some(50_000),
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(100),
            practice_role: PracticeRole::Opener,
            ..Default::default()
        };

        let mut rng_val = 0.5_f64;
        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || {
            let v = rng_val;
            rng_val += 0.1;
            v
        })
        .unwrap();

        // When opener, South should be the dealer (constraints rotated)
        assert_eq!(bundle.deal.dealer, Seat::South);
        assert_eq!(bundle.resolved_role, PracticeRole::Opener);
    }

    #[test]
    fn start_drill_both_role_resolves() {
        let convention = ConventionConfig {
            id: "test".to_string(),
            deal_constraints: DealConstraints {
                seats: vec![],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: None,
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(42),
            practice_role: PracticeRole::Both,
            ..Default::default()
        };

        // rng returns 0.3 -> Opener
        let mut bundle =
            start_drill(&convention, Seat::South, config, &options, &mut || 0.3).unwrap();
        assert_eq!(bundle.resolved_role, PracticeRole::Opener);

        // rng returns 0.7 -> Responder
        let config2 = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };
        bundle = start_drill(&convention, Seat::South, config2, &options, &mut || 0.7).unwrap();
        assert_eq!(bundle.resolved_role, PracticeRole::Responder);
    }

    #[test]
    fn start_drill_full_auction_mode_play_preference() {
        let convention = ConventionConfig {
            id: "test".to_string(),
            deal_constraints: DealConstraints {
                seats: vec![],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: None,
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(42),
            practice_mode: PracticeMode::FullAuction,
            ..Default::default()
        };

        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || 0.5).unwrap();

        // Full auction defaults to Prompt, not Skip
        assert_eq!(bundle.play_preference, PlayPreference::Prompt);
    }

    // ── Initial auction derivation tests ────────────────────────

    fn bergen_like_convention(seed: u64) -> (ConventionConfig, DrillConfig, StartDrillOptions) {
        let mut min_any_n = HashMap::new();
        min_any_n.insert(Suit::Hearts, 5_u8);
        min_any_n.insert(Suit::Spades, 5_u8);

        let convention = ConventionConfig {
            id: "bergen-test".to_string(),
            deal_constraints: DealConstraints {
                seats: vec![SeatConstraint {
                    seat: Seat::North,
                    min_hcp: Some(12),
                    max_hcp: Some(21),
                    balanced: None,
                    min_length: None,
                    max_length: None,
                    min_length_any: Some(min_any_n),
                }],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: Some(50_000),
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "bergen-test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(seed),
            ..Default::default()
        };

        (convention, config, options)
    }

    #[test]
    fn start_drill_bergen_constraints_produce_major_opening() {
        let (convention, config, options) = bergen_like_convention(42);
        let mut rng_val = 0.5_f64;
        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || {
            let v = rng_val;
            rng_val += 0.1;
            v
        })
        .unwrap();

        // Bergen-like constraints should always produce an initial 1H or 1S auction
        let auction = bundle
            .initial_auction
            .expect("Bergen should have initial auction");
        assert_eq!(auction.entries.len(), 1);
        assert_eq!(auction.entries[0].seat, Seat::North);
        match &auction.entries[0].call {
            Call::Bid {
                level: 1,
                strain: BidSuit::Hearts,
            }
            | Call::Bid {
                level: 1,
                strain: BidSuit::Spades,
            } => {}
            other => panic!("Expected 1H or 1S, got {:?}", other),
        }
    }

    #[test]
    fn start_drill_bergen_picks_correct_major_for_deal() {
        // Try multiple seeds — the opening should match the deal's longer major
        for seed in 42..52 {
            let (convention, config, options) = bergen_like_convention(seed);
            let mut rng_val = 0.5_f64;
            let bundle = start_drill(&convention, Seat::South, config, &options, &mut || {
                let v = rng_val;
                rng_val += 0.1;
                v
            })
            .unwrap();

            let auction = bundle.initial_auction.expect("Should have initial auction");
            let opener_hand = bundle.deal.hands.get(&Seat::North).unwrap();
            let hearts = opener_hand
                .cards
                .iter()
                .filter(|c| c.suit == Suit::Hearts)
                .count();
            let spades = opener_hand
                .cards
                .iter()
                .filter(|c| c.suit == Suit::Spades)
                .count();

            let expected_strain = if spades > hearts {
                BidSuit::Spades
            } else {
                BidSuit::Hearts
            };
            assert_eq!(
                auction.entries[0].call,
                Call::Bid {
                    level: 1,
                    strain: expected_strain
                },
                "seed={seed}: North has {hearts}H {spades}S, expected {:?}",
                expected_strain,
            );
        }
    }

    #[test]
    fn start_drill_nt_constraints_produce_1nt_opening() {
        let convention = ConventionConfig {
            id: "nt-test".to_string(),
            deal_constraints: DealConstraints {
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
                max_attempts: Some(50_000),
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "nt-test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(42),
            ..Default::default()
        };

        let mut rng_val = 0.5_f64;
        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || {
            let v = rng_val;
            rng_val += 0.1;
            v
        })
        .unwrap();

        let auction = bundle
            .initial_auction
            .expect("NT should have initial auction");
        assert_eq!(auction.entries.len(), 1);
        assert_eq!(
            auction.entries[0].call,
            Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump
            }
        );
    }

    #[test]
    fn start_drill_opener_role_gets_no_initial_auction() {
        let (convention, config, options) = bergen_like_convention(42);
        let options = StartDrillOptions {
            practice_role: PracticeRole::Opener,
            ..options
        };

        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || 0.5).unwrap();

        assert!(
            bundle.initial_auction.is_none(),
            "Opener should not get initial auction — they make the first bid"
        );
    }

    #[test]
    fn start_drill_no_constraints_no_initial_auction() {
        let convention = ConventionConfig {
            id: "empty".to_string(),
            deal_constraints: DealConstraints {
                seats: vec![],
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: None,
                seed: None,
            },
            allowed_dealers: None,
            off_convention_constraints: None,
        };

        let config = DrillConfig {
            convention_id: "empty".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };

        let options = StartDrillOptions {
            seed: Some(42),
            ..Default::default()
        };

        let mut rng_val = 0.5_f64;
        let bundle = start_drill(&convention, Seat::South, config, &options, &mut || {
            let v = rng_val;
            rng_val += 0.1;
            v
        })
        .unwrap();

        assert!(bundle.initial_auction.is_none());
    }
}
