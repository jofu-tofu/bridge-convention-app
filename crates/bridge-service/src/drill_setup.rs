//! Drill session setup — resolves config, builds bundle inputs, and creates
//! the initial SessionState for a new drill session.
//!
//! Phase 2: picks a target surface deterministically, enumerates witnesses,
//! projects the chosen witness into `DealConstraints`, and drives a
//! witness-verifying rejection-sampling predicate.

use std::collections::HashMap;
use std::sync::Arc;

use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::types::{DealConstraints, Seat};
use bridge_session::heuristics::{
    BiddingStrategy, NaturalFallbackStrategy, PassStrategy, PragmaticStrategy, StrategyChain,
};
use bridge_session::inference::InferenceCoordinator;
use bridge_session::session::start_drill::ConventionConfig;
use bridge_session::session::{initialize_auction, start_drill, SeatStrategy, SessionState};
use bridge_session::types::{OpponentMode, PracticeRole};

use crate::bundle_resolver;
use crate::config_resolver;
use crate::convention_adapter::ConventionStrategyAdapter;
use crate::error::ServiceError;
use crate::request_types::SessionConfig;
use crate::validation;
use crate::witness_selection::{
    initial_auction_from_witness, select_witness, witness_is_concrete_only, WitnessSelection,
};

/// Maximum number of internal retries on deal-generation exhaustion.
///
/// Witness-based derivation occasionally picks a surface/witness combo that
/// exceeds the inner rejection-sampling budget (~15% of nt-bundle drills).
/// We retry internally so users never see routine exhaustion. Only a true
/// bug would exhaust all 8 attempts.
const MAX_DRILL_SETUP_RETRIES: u32 = 8;

/// Phase 3j: scale rejection-sampling attempts with witness prefix length.
///
/// Each opponent witness step is one more place where the AI's natural call
/// must align with the witness pattern, so acceptance rate degrades with
/// prefix length. Negdbl-opener witnesses run 3+ steps (1 partnership open,
/// 1 opponent overcall, 1 partnership double); doubling-or-tripling the
/// budget keeps user-visible exhaustion rare without making short-prefix
/// drills slow. Capped at 5x to avoid pathological waits.
fn deal_attempt_budget(witness_prefix_len: usize) -> u64 {
    let scale = 1 + (witness_prefix_len / 2).min(4) as u64;
    bridge_session::session::start_drill::NORMAL_DEAL_ATTEMPTS * scale
}

/// Derive a per-attempt seed from the base seed and attempt index. Uses a
/// mix of multiplicative and XOR so both witness selection and deal
/// generation explore different parts of the search space each attempt.
fn shift_seed(base: u64, attempt: u32) -> u64 {
    // Splitmix-style shift: multiply by large odd constant, XOR with
    // attempt-derived salt. Deterministic in (base, attempt).
    let salt = (attempt as u64)
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(0xDEAD_BEEF_CAFE_BABE);
    base.wrapping_add(salt) ^ salt.rotate_left(17)
}

fn resolve_practice_role(
    requested_role: PracticeRole,
    rng: &mut rand_chacha::ChaCha8Rng,
) -> PracticeRole {
    match requested_role {
        PracticeRole::Both => {
            if rand::Rng::gen::<f64>(rng) < 0.5 {
                PracticeRole::Opener
            } else {
                PracticeRole::Responder
            }
        }
        other => other,
    }
}

/// Build a seat→`Arc<dyn BiddingStrategy>` map for post-flight pattern-witness
/// materialization. Mirrors `config_resolver::build_seat_strategies` but
/// returns Arcs so a single adapter can be shared across user + partner; the
/// materializer runs once after deal selection so adapter `last_evaluation`
/// state isn't an issue.
fn build_arc_seat_strategies(
    user_seat: Seat,
    opponent_mode: OpponentMode,
    spec: &Option<bridge_conventions::ConventionSpec>,
    surface_groups: &[bridge_conventions::teaching::teaching_types::SurfaceGroup],
) -> HashMap<Seat, Arc<dyn BiddingStrategy>> {
    let mut m: HashMap<Seat, Arc<dyn BiddingStrategy>> = HashMap::new();
    if let Some(ref spec) = spec {
        let adapter = Arc::new(ConventionStrategyAdapter::new(
            spec.clone(),
            surface_groups.to_vec(),
        ));
        m.insert(user_seat, adapter.clone() as Arc<dyn BiddingStrategy>);
        m.insert(
            partner_seat(user_seat),
            adapter as Arc<dyn BiddingStrategy>,
        );
    }
    let opp_seats = [next_seat(user_seat), next_seat(partner_seat(user_seat))];
    for &opp in &opp_seats {
        let strategy: Arc<dyn BiddingStrategy> = match opponent_mode {
            OpponentMode::Natural => Arc::new(StrategyChain::new(vec![
                Box::new(PragmaticStrategy),
                Box::new(NaturalFallbackStrategy),
                Box::new(PassStrategy),
            ])),
            OpponentMode::None => Arc::new(PassStrategy),
        };
        m.insert(opp, strategy);
    }
    m
}

fn witness_dealer_for_role(user_seat: Seat, role: PracticeRole) -> Seat {
    match role {
        PracticeRole::Opener => user_seat,
        PracticeRole::Responder => partner_seat(user_seat),
        PracticeRole::Both => unreachable!("resolve_practice_role must run first"),
    }
}

/// Fully resolved drill context ready for session creation.
pub(crate) struct DrillSetupResult {
    pub state: SessionState,
    pub seat_strategies: HashMap<bridge_engine::types::Seat, SeatStrategy>,
    pub drill_config: bridge_session::session::DrillConfig,
    /// Phase 2: target `(module_id, surface_id)` picked for this drill.
    /// Exposed for downstream debug/recording. `None` if the bundle had no
    /// drill-worthy surfaces (legacy/unknown bundles).
    #[allow(dead_code)]
    pub target_module_id: Option<String>,
    #[allow(dead_code)]
    pub target_surface_id: Option<String>,
}

/// Resolve a `SessionConfig` into a ready-to-use `DrillSetupResult`.
///
/// Performs config resolution, bundle lookup, spec building, surface group
/// resolution, witness selection, convention config assembly, deal
/// generation (with witness-verifying rejection sampling), initial auction
/// application, and seat strategy construction.
pub(crate) fn build_drill_setup(config: &SessionConfig) -> Result<DrillSetupResult, ServiceError> {
    // 1. Resolve config defaults
    let resolved = config_resolver::resolve_config(config);

    // 2. Validate injected system config
    validation::validate_system_config(&resolved.system_config)?;
    validation::validate_base_module_ids(&resolved.base_module_ids)?;

    // 3. Look up bundle metadata
    let bundle_input = bundle_resolver::get_bundle_input(&config.convention_id)?;

    let system = resolved.system_config.system_id;

    // 4. Build convention spec for strategy wiring
    let spec = bridge_conventions::registry::spec_builder::spec_from_bundle(
        &config.convention_id,
        &resolved.system_config,
        &resolved.base_module_ids,
        &HashMap::new(),
    );

    // 5. Resolve surface groups
    let surface_groups = bundle_resolver::resolve_surface_groups(&config.convention_id, system);

    // 6. Phase 2a + 2b: pick target surface, enumerate witnesses, project one.
    use rand::Rng;
    use rand::SeedableRng;
    let base_seed = config.seed.unwrap_or_else(|| rand::thread_rng().gen());

    // Phase 3: every drillable bundle now flows through `select_witness`.
    // The negative-doubles bypass that previously skipped enumeration was
    // removed; its prefix shapes are encoded as `Subseq` routes with
    // `actor: opponent` steps, materialized via `ScriptedOpponentStrategy`
    // in the rejection-sampling predicate.

    // Retry loop: on `DealGenerationExhausted` from `start_drill`, shift the
    // seed (diversifying both witness selection and deal sampling) and try
    // again, up to `MAX_DRILL_SETUP_RETRIES` times. Only a genuine bug
    // signal should reach the outer `Err` path.
    let mut options = resolved.options;
    let (drill_bundle, witness_selection, _convention_config, final_seed) = {
        let mut last_err: Option<ServiceError> = None;
        let mut last_target: Option<(String, String)> = None;
        let mut result = None;
        for attempt in 0..MAX_DRILL_SETUP_RETRIES {
            // Shift both witness-selection and deal-generation seeds.
            let attempt_seed = if attempt == 0 {
                base_seed
            } else {
                shift_seed(base_seed, attempt)
            };
            let mut attempt_rng = rand_chacha::ChaCha8Rng::seed_from_u64(attempt_seed);
            let resolved_role = resolve_practice_role(options.practice_role, &mut attempt_rng);
            let witness_dealer = witness_dealer_for_role(resolved.user_seat, resolved_role);

            let target_selector = config.target.clone().unwrap_or_default();
            let witness_selection: Option<WitnessSelection> = match select_witness(
                &bundle_input.member_ids,
                &resolved.base_module_ids,
                system,
                &resolved.system_config,
                resolved_role,
                witness_dealer,
                &target_selector,
                attempt_seed,
            ) {
                Ok(w) => w,
                Err(msg) => {
                    let err = ServiceError::DealGenerationExhausted {
                        witness_summary: msg,
                    };
                    tracing::warn!(
                        attempt,
                        convention_id = %config.convention_id,
                        "witness selection failed; retrying with shifted seed"
                    );
                    last_err = Some(err);
                    continue;
                }
            };

            let convention_config = build_convention_config_with_witness(
                &config.convention_id,
                config.vulnerability,
                Some(attempt_seed),
                witness_selection.as_ref().map(|w| &w.projected_constraints),
            );

            options.practice_role = resolved_role;
            let mut rng = attempt_rng;
            let mut rng_fn = move || -> f64 { rng.gen() };

            // 8. Wire the witness-verifying predicate.
            options.deal_acceptance_predicate = if let Some(ref ws) = witness_selection {
                crate::deal_gating::build_witness_acceptance_predicate(
                    &spec,
                    &surface_groups,
                    ws.witness.clone(),
                    resolved_role,
                    Some(convention_config.deal_constraints.clone()),
                    &config.convention_id,
                    resolved.opponent_mode,
                )
            } else {
                None
            };
            // Phase 3j: scale the rejection-sampling budget with the
            // witness prefix length. Each scripted opponent step is one
            // more place where the live AI must align with the witness, so
            // longer prefixes have lower acceptance rates. Bundles without
            // a witness fall back to the default budget.
            options.deal_attempts = witness_selection
                .as_ref()
                .map(|ws| deal_attempt_budget(ws.witness.prefix.len()));
            // Pre-flight initial-auction override only fires for concrete-only
            // witnesses (no deal/strategies needed). Pattern witnesses are
            // materialized post-flight using the chosen deal + seat strategies.
            options.initial_auction_override = witness_selection.as_ref().and_then(|ws| {
                if witness_is_concrete_only(&ws.witness) {
                    let stub_deal_unused = bridge_engine::types::Deal {
                        hands: HashMap::new(),
                        dealer: ws.witness.dealer,
                        vulnerability: bridge_engine::types::Vulnerability::None,
                    };
                    let empty_strategies: HashMap<
                        Seat,
                        Arc<dyn BiddingStrategy>,
                    > = HashMap::new();
                    initial_auction_from_witness(
                        &ws.witness,
                        &stub_deal_unused,
                        &empty_strategies,
                    )
                } else {
                    None
                }
            });

            // Rebuild a fresh DrillConfig each attempt since start_drill
            // consumes it (and DrillConfig isn't Clone due to `dyn` boxes,
            // though seat_strategies is empty here).
            let attempt_drill_config = bridge_session::session::DrillConfig {
                convention_id: config.convention_id.clone(),
                user_seat: resolved.user_seat,
                seat_strategies: HashMap::new(),
            };

            match start_drill(
                &convention_config,
                resolved.user_seat,
                attempt_drill_config,
                &options,
                &mut rng_fn,
            ) {
                Ok(bundle) => {
                    if attempt > 0 {
                        tracing::debug!(
                            attempt,
                            convention_id = %config.convention_id,
                            "drill setup succeeded after retry"
                        );
                    }
                    result = Some((bundle, witness_selection, convention_config, attempt_seed));
                    break;
                }
                Err(msg) if msg.starts_with("deal generation exhausted") => {
                    if let Some(ref ws) = witness_selection {
                        last_target =
                            Some((ws.target_module_id.clone(), ws.target_surface_id.clone()));
                    }
                    tracing::warn!(
                        attempt,
                        convention_id = %config.convention_id,
                        witness = ?witness_selection
                            .as_ref()
                            .map(|w| format!("{}/{}", w.target_module_id, w.target_surface_id)),
                        "deal generation exhausted; retrying with shifted seed"
                    );
                    last_err = Some(ServiceError::DealGenerationExhausted {
                        witness_summary: witness_selection
                            .as_ref()
                            .map(|w| format!("{}/{}", w.target_module_id, w.target_surface_id))
                            .unwrap_or_else(|| msg.clone()),
                    });
                    continue;
                }
                Err(msg) => return Err(ServiceError::Internal(msg)),
            }
        }
        match result {
            Some(r) => r,
            None => {
                let target_selector = config.target.clone().unwrap_or_default();
                let target_kind = match &target_selector {
                    bridge_conventions::types::rule_types::TargetSelector::Any => "any",
                    bridge_conventions::types::rule_types::TargetSelector::Module { .. } => {
                        "module"
                    }
                    bridge_conventions::types::rule_types::TargetSelector::Surface { .. } => {
                        "surface"
                    }
                };
                let (target_module_id, target_surface_id) = match &last_target {
                    Some((m, s)) => (Some(m.as_str()), Some(s.as_str())),
                    None => (None, None),
                };
                // Outer-loop exhaustion is the genuine bug signal: we burned
                // every seed-shifted retry. Counter event for telemetry —
                // group by `(convention_id, target_surface_id)` to surface
                // pathological surfaces.
                tracing::warn!(
                    counter.drill_generation_exhausted = 1u64,
                    convention_id = %config.convention_id,
                    target_kind,
                    target_module_id,
                    target_surface_id,
                    attempts_used = MAX_DRILL_SETUP_RETRIES,
                    "drill_generation_exhausted: all seed-shifted retries failed"
                );
                return Err(last_err.unwrap_or_else(|| {
                    ServiceError::Internal("drill setup exhausted all retries".into())
                }));
            }
        }
    };
    let seed = final_seed;

    // 9. Build inference coordinator + session state
    let coordinator = InferenceCoordinator::new(None);

    // 9a. Pattern witness post-flight materialization. When the chosen witness
    // includes pattern steps, `start_drill` returned a deal but no
    // initial_auction_override was supplied; materialize one now using the
    // concrete deal + Arc-cloneable seat strategies before initialize_auction.
    // Pattern witnesses materialize post-flight regardless of whether
    // start_drill produced a fallback initial_auction (it may have run
    // `derive_initial_auction` against the projected constraints, which is
    // unrelated to the witness shape).
    let pattern_initial_auction: Option<bridge_engine::types::Auction> =
        match witness_selection.as_ref() {
            Some(ws) if !witness_is_concrete_only(&ws.witness) => {
                let arc_strategies = build_arc_seat_strategies(
                    resolved.user_seat,
                    resolved.opponent_mode,
                    &spec,
                    &surface_groups,
                );
                initial_auction_from_witness(
                    &ws.witness,
                    &drill_bundle.deal,
                    &arc_strategies,
                )
            }
            _ => None,
        };

    let mut state = SessionState::new(
        drill_bundle.deal,
        resolved.user_seat,
        config.convention_id.clone(),
        Some(bundle_input.name.clone()),
        coordinator,
        drill_bundle.is_off_convention,
        drill_bundle.practice_mode,
        drill_bundle.practice_focus,
        drill_bundle.play_preference,
        resolved.play_profile_id,
        seed,
    );

    // Pattern witness materialization wins over start_drill's fallback —
    // start_drill ran `derive_initial_auction` against projected constraints,
    // which is unaware of the witness's pattern steps.
    if let Some(ref initial_auction) = pattern_initial_auction {
        initialize_auction(&mut state, initial_auction, &HashMap::new());
    } else if let Some(ref initial_auction) = drill_bundle.initial_auction {
        initialize_auction(&mut state, initial_auction, &HashMap::new());
    }

    // 10. Build seat strategies
    let seat_strategies = config_resolver::build_seat_strategies(
        resolved.user_seat,
        resolved.opponent_mode,
        &spec,
        &surface_groups,
    );

    let drill_config = bridge_session::session::DrillConfig {
        convention_id: config.convention_id.clone(),
        user_seat: resolved.user_seat,
        seat_strategies: HashMap::new(),
    };

    let (target_module_id, target_surface_id) = match witness_selection {
        Some(ws) => (Some(ws.target_module_id), Some(ws.target_surface_id)),
        None => (None, None),
    };

    Ok(DrillSetupResult {
        state,
        seat_strategies,
        drill_config,
        target_module_id,
        target_surface_id,
    })
}

/// Build a `ConventionConfig` using projected witness constraints when
/// present, or a minimal dealer-only constraint when absent. Replaces v1's
/// `bundle_resolver::build_convention_config` which derived bounds from
/// `derive_deal_constraints`.
fn build_convention_config_with_witness(
    convention_id: &str,
    vulnerability_override: Option<bridge_engine::types::Vulnerability>,
    seed: Option<u64>,
    projected: Option<&DealConstraints>,
) -> ConventionConfig {
    let base = match projected {
        Some(p) => p.clone(),
        None => DealConstraints {
            seats: Vec::new(),
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: Some(50_000),
            seed: None,
        },
    };

    let deal_constraints = DealConstraints {
        vulnerability: vulnerability_override,
        max_attempts: base.max_attempts.or(Some(50_000)),
        seed,
        ..base
    };

    // Preserve bundle-declared allowed_dealers for dealer rotation.
    let allowed_dealers = bridge_conventions::registry::resolve_bundle(
        convention_id,
        bridge_conventions::types::BaseSystemId::Sayc,
    )
    .and_then(|b| b.allowed_dealers.clone());

    ConventionConfig {
        id: convention_id.to_string(),
        deal_constraints,
        allowed_dealers,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_session::session::start_drill::NORMAL_DEAL_ATTEMPTS;

    /// Locks the Phase 3j scaling formula: `1 + min(prefix_len / 2, 4)`.
    /// Each pair of witness-prefix steps (one partnership + one opponent
    /// in a typical interference sequence) adds another `NORMAL_DEAL_ATTEMPTS`
    /// to the rejection-sampling budget, capped at 5x to bound worst-case
    /// drill startup latency.
    #[test]
    fn deal_attempt_budget_scales_with_witness_prefix_length() {
        // prefix_len ∈ {0, 1} → 1× (32 attempts)
        assert_eq!(deal_attempt_budget(0), NORMAL_DEAL_ATTEMPTS);
        assert_eq!(deal_attempt_budget(1), NORMAL_DEAL_ATTEMPTS);
        // prefix_len ∈ {2, 3} → 2× (64)
        assert_eq!(deal_attempt_budget(2), NORMAL_DEAL_ATTEMPTS * 2);
        assert_eq!(deal_attempt_budget(3), NORMAL_DEAL_ATTEMPTS * 2);
        // prefix_len ∈ {4, 5} → 3× (96)
        assert_eq!(deal_attempt_budget(4), NORMAL_DEAL_ATTEMPTS * 3);
        assert_eq!(deal_attempt_budget(5), NORMAL_DEAL_ATTEMPTS * 3);
        // prefix_len ∈ {6, 7} → 4× (128)
        assert_eq!(deal_attempt_budget(6), NORMAL_DEAL_ATTEMPTS * 4);
        assert_eq!(deal_attempt_budget(7), NORMAL_DEAL_ATTEMPTS * 4);
        // prefix_len = 8 → 5× (160) — saturation point.
        assert_eq!(deal_attempt_budget(8), NORMAL_DEAL_ATTEMPTS * 5);
        // Saturates at 5× for any prefix_len ≥ 8.
        assert_eq!(deal_attempt_budget(20), NORMAL_DEAL_ATTEMPTS * 5);
        assert_eq!(deal_attempt_budget(100), NORMAL_DEAL_ATTEMPTS * 5);
    }
}
