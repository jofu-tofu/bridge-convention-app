//! Config resolution — parses SessionConfig into validated session parameters.
//!
//! Resolves defaults, builds seat strategies, and assembles the drill inputs
//! needed by `create_drill_session()`.

use std::collections::HashMap;

use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::types::Seat;
use bridge_session::session::start_drill::StartDrillOptions;
use bridge_session::session::{DrillConfig, SeatStrategy};
use bridge_session::types::{OpponentMode, PracticeMode, PracticeRole};

use crate::request_types::SessionConfig;

// ── Resolved config ──────────────────────────────────────────────

/// Validated and defaulted session parameters extracted from `SessionConfig`.
pub(crate) struct ResolvedConfig {
    pub system_config: SystemConfig,
    pub base_module_ids: Vec<String>,
    pub user_seat: Seat,
    pub opponent_mode: OpponentMode,
    pub drill_config: DrillConfig,
    pub options: StartDrillOptions,
}

// ── Full config resolution ───────────────────────────────────────

/// Resolve a `SessionConfig` into validated defaults and drill parameters.
pub(crate) fn resolve_config(config: &SessionConfig) -> ResolvedConfig {
    let user_seat = config.user_seat.unwrap_or(Seat::South);
    let practice_mode = config.practice_mode.unwrap_or(PracticeMode::DecisionDrill);
    let practice_role = config.practice_role.unwrap_or(PracticeRole::Responder);
    let opponent_mode = config.opponent_mode.unwrap_or(OpponentMode::Natural);

    let drill_config = DrillConfig {
        convention_id: config.convention_id.clone(),
        user_seat,
        seat_strategies: HashMap::new(),
    };

    let options = StartDrillOptions {
        practice_mode,
        practice_role,
        play_preference: config.play_preference,
        opponent_mode,
        seed: config.seed,
        ..Default::default()
    };

    ResolvedConfig {
        system_config: config.system_config.clone(),
        base_module_ids: config.base_module_ids.clone(),
        user_seat,
        opponent_mode,
        drill_config,
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
