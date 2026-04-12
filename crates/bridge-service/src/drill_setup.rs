//! Drill session setup — resolves config, builds bundle inputs, and creates
//! the initial SessionState for a new drill session.
//!
//! Phase 2: picks a target surface deterministically, enumerates witnesses,
//! projects the chosen witness into `DealConstraints`, and drives a
//! witness-verifying rejection-sampling predicate.

use std::collections::HashMap;

use bridge_engine::types::{DealConstraints, Seat};
use bridge_session::inference::InferenceCoordinator;
use bridge_session::session::start_drill::ConventionConfig;
use bridge_session::session::{initialize_auction, start_drill, SeatStrategy, SessionState};

use crate::bundle_resolver;
use crate::config_resolver;
use crate::error::ServiceError;
use crate::request_types::SessionConfig;
use crate::validation;
use crate::witness_selection::{select_witness, WitnessSelection};

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
    let seed = config.seed.unwrap_or_else(|| rand::thread_rng().gen());

    // Negative-doubles bundle retains its bespoke predicate + v1-style
    // assembly path. Witness enumeration is skipped for it.
    let is_negdbl = config.convention_id == "negative-doubles-bundle";

    let witness_selection: Option<WitnessSelection> = if is_negdbl {
        None
    } else {
        select_witness(
            &bundle_input.member_ids,
            &resolved.base_module_ids,
            system,
            resolved.options.practice_role,
            // Witness enumeration uses dealer = North (drill convention).
            Seat::North,
            config.target_module_id.as_deref(),
            seed,
        )
        .map_err(|msg| ServiceError::DealGenerationExhausted {
            witness_summary: msg,
        })?
    };

    // 7. Build convention config — deal_constraints come from the projected
    // witness when available, otherwise fall back to legacy-empty bounds
    // (negdbl / uncovered cases).
    let convention_config = build_convention_config_with_witness(
        &config.convention_id,
        config.vulnerability,
        config.seed,
        witness_selection.as_ref().map(|w| &w.projected_constraints),
    );

    let mut rng = rand_chacha::ChaCha8Rng::seed_from_u64(seed);
    let mut rng_fn = move || -> f64 { rng.gen() };

    // 8. Wire the witness-verifying predicate (non-negdbl only).
    let mut options = resolved.options;
    options.deal_acceptance_predicate = if let Some(ref ws) = witness_selection {
        crate::deal_gating::build_witness_acceptance_predicate(
            &spec,
            &surface_groups,
            ws.witness.clone(),
            options.practice_role,
            Some(convention_config.deal_constraints.clone()),
            &config.convention_id,
            resolved.opponent_mode,
        )
    } else {
        None
    };

    let drill_bundle = start_drill(
        &convention_config,
        resolved.user_seat,
        resolved.drill_config,
        &options,
        &mut rng_fn,
    )
    .map_err(|msg| {
        if msg.starts_with("deal generation exhausted") {
            ServiceError::DealGenerationExhausted {
                witness_summary: witness_selection
                    .as_ref()
                    .map(|w| format!("{}/{}", w.target_module_id, w.target_surface_id))
                    .unwrap_or_else(|| msg.clone()),
            }
        } else {
            ServiceError::Internal(msg)
        }
    })?;

    // 9. Build inference coordinator + session state
    let coordinator = InferenceCoordinator::new(None);

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
        bridge_session::heuristics::play_profiles::PlayProfileId::ClubPlayer,
        seed,
    );

    if let Some(ref initial_auction) = drill_bundle.initial_auction {
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
