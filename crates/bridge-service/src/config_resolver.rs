//! Config resolution — parses SessionConfig into validated session parameters.
//!
//! Resolves defaults, builds seat strategies, and assembles the drill inputs
//! needed by `create_drill_session()`.

use std::collections::HashMap;

use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::types::Seat;
use bridge_engine::types::Vulnerability;
use bridge_session::heuristics::play_profiles::PlayProfileId;
use bridge_session::session::start_drill::StartDrillOptions;
use bridge_session::session::SeatStrategy;
use bridge_session::types::{
    DrillTuning, OpponentMode, PracticeMode, PracticeRole, VulnerabilityDistribution,
};

use crate::request_types::SessionConfig;

// ── Resolved config ──────────────────────────────────────────────

/// Validated and defaulted session parameters extracted from `SessionConfig`.
pub(crate) struct ResolvedConfig {
    pub system_config: SystemConfig,
    pub base_module_ids: Vec<String>,
    pub user_seat: Seat,
    pub opponent_mode: OpponentMode,
    pub play_profile_id: PlayProfileId,
    pub options: StartDrillOptions,
}

// ── Full config resolution ───────────────────────────────────────

/// Resolve a `SessionConfig` into validated defaults and drill parameters.
pub(crate) fn resolve_config(config: &SessionConfig) -> ResolvedConfig {
    let user_seat = config.user_seat.unwrap_or(Seat::South);
    let practice_mode = config.practice_mode.unwrap_or(PracticeMode::DecisionDrill);
    let practice_role = config.practice_role.unwrap_or(PracticeRole::Responder);
    let opponent_mode = config.opponent_mode.unwrap_or(OpponentMode::Natural);
    let play_profile_id = config.play_profile_id.unwrap_or(PlayProfileId::ClubPlayer);

    // An explicit `vulnerability` override (used by tests / dev tools)
    // outranks the per-drill distribution: collapse the distribution to a
    // single non-zero bucket matching the requested vulnerability so that
    // `start_drill::pick_vulnerability` returns it deterministically. The
    // sampler in `start_drill` is the single point of vulnerability
    // selection — we can't bypass it, so we shape its input instead.
    let user_is_ns = matches!(user_seat, Seat::North | Seat::South);
    let tuning = if let Some(forced) = config.vulnerability {
        let dist = match forced {
            Vulnerability::None => VulnerabilityDistribution {
                none: 1.0,
                ours: 0.0,
                theirs: 0.0,
                both: 0.0,
            },
            Vulnerability::Both => VulnerabilityDistribution {
                none: 0.0,
                ours: 0.0,
                theirs: 0.0,
                both: 1.0,
            },
            Vulnerability::NorthSouth => {
                if user_is_ns {
                    VulnerabilityDistribution {
                        none: 0.0,
                        ours: 1.0,
                        theirs: 0.0,
                        both: 0.0,
                    }
                } else {
                    VulnerabilityDistribution {
                        none: 0.0,
                        ours: 0.0,
                        theirs: 1.0,
                        both: 0.0,
                    }
                }
            }
            Vulnerability::EastWest => {
                if user_is_ns {
                    VulnerabilityDistribution {
                        none: 0.0,
                        ours: 0.0,
                        theirs: 1.0,
                        both: 0.0,
                    }
                } else {
                    VulnerabilityDistribution {
                        none: 0.0,
                        ours: 1.0,
                        theirs: 0.0,
                        both: 0.0,
                    }
                }
            }
        };
        DrillTuning {
            vulnerability_distribution: dist,
            module_weights: None,
        }
    } else {
        match config.vulnerability_distribution.clone() {
            Some(dist) => DrillTuning {
                vulnerability_distribution: dist,
                module_weights: None,
            },
            None => DrillTuning::default(),
        }
    };

    let options = StartDrillOptions {
        practice_mode,
        practice_role,
        play_preference: config.play_preference,
        opponent_mode,
        tuning,
        seed: config.seed,
        ..Default::default()
    };

    ResolvedConfig {
        system_config: config.system_config.clone(),
        base_module_ids: config.base_module_ids.clone(),
        user_seat,
        opponent_mode,
        play_profile_id,
        options,
    }
}

// ── Seat strategies ──────────────────────────────────────────────

/// Build seat strategies: convention adapters for user + partner,
/// heuristic strategies for opponents based on opponent mode.
pub(crate) fn build_seat_strategies(
    user_seat: Seat,
    opponent_mode: OpponentMode,
    spec: &Option<bridge_conventions::ConventionSpec>,
    surface_groups: &[bridge_conventions::teaching::teaching_types::SurfaceGroup],
) -> HashMap<Seat, SeatStrategy> {
    let mut m = HashMap::new();
    if let Some(ref spec) = spec {
        m.insert(
            user_seat,
            SeatStrategy::Ai(Box::new(
                crate::convention_adapter::ConventionStrategyAdapter::new(
                    spec.clone(),
                    surface_groups.to_vec(),
                ),
            )),
        );
        m.insert(
            partner_seat(user_seat),
            SeatStrategy::Ai(Box::new(
                crate::convention_adapter::ConventionStrategyAdapter::new(
                    spec.clone(),
                    surface_groups.to_vec(),
                ),
            )),
        );
    }

    let opp_seats = [next_seat(user_seat), next_seat(partner_seat(user_seat))];
    for &opp in &opp_seats {
        match opponent_mode {
            OpponentMode::Natural => {
                // Chain: pragmatic → natural fallback → pass
                let chain = bridge_session::heuristics::StrategyChain::new(vec![
                    Box::new(bridge_session::heuristics::PragmaticStrategy),
                    Box::new(bridge_session::heuristics::NaturalFallbackStrategy),
                    Box::new(bridge_session::heuristics::PassStrategy),
                ]);
                m.insert(opp, SeatStrategy::Ai(Box::new(chain)));
            }
            OpponentMode::None => {
                m.insert(
                    opp,
                    SeatStrategy::Ai(Box::new(bridge_session::heuristics::PassStrategy)),
                );
            }
        };
    }
    m
}
