//! Drill session setup — resolves config, builds bundle inputs, and creates
//! the initial SessionState for a new drill session.
//!
//! Extracted from `create_drill_session()` to isolate the 6 setup
//! responsibilities: config resolution, bundle lookup, spec building,
//! surface groups, convention config, and seat strategy construction.

use std::collections::HashMap;

use bridge_session::inference::InferenceCoordinator;
use bridge_session::session::{initialize_auction, start_drill, SeatStrategy, SessionState};

use crate::bundle_resolver;
use crate::config_resolver;
use crate::error::ServiceError;
use crate::request_types::SessionConfig;
use crate::validation;

/// Fully resolved drill context ready for session creation.
pub(crate) struct DrillSetupResult {
    pub state: SessionState,
    pub seat_strategies: HashMap<bridge_engine::types::Seat, SeatStrategy>,
    pub drill_config: bridge_session::session::DrillConfig,
}

/// Resolve a `SessionConfig` into a ready-to-use `DrillSetupResult`.
///
/// Performs config resolution, bundle lookup, spec building, surface group
/// resolution, convention config assembly, deal generation, initial auction
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

    // 5. Resolve surface groups and convention config from bundle
    let surface_groups = bundle_resolver::resolve_surface_groups(&config.convention_id, system);
    let convention_config = bundle_resolver::build_convention_config(
        &config.convention_id,
        system,
        config.vulnerability,
        config.seed,
    );

    // 6. Generate deal via start_drill
    use rand::Rng;
    use rand::SeedableRng;
    let seed = config.seed.unwrap_or_else(|| rand::thread_rng().gen());
    let mut rng = rand_chacha::ChaCha8Rng::seed_from_u64(seed);
    let mut rng_fn = move || -> f64 { rng.gen() };

    // Build rejection-sampling predicate from adapter + bundle member ids.
    // Uses the exact spec/surface_groups the live session will use, so the
    // adapter's run_pipeline (with FSM replay) is faithfully reproduced for
    // each candidate deal at the user's turn.
    let mut options = resolved.options;
    options.deal_acceptance_predicate = crate::deal_gating::build_deal_acceptance_predicate(
        &spec,
        &surface_groups,
        &bundle_input.member_ids,
        options.practice_role,
        Some(convention_config.deal_constraints.clone()),
    );

    let drill_bundle = start_drill(
        &convention_config,
        resolved.user_seat,
        resolved.drill_config,
        &options,
        &mut rng_fn,
    )
    .map_err(ServiceError::Internal)?;

    // 7. Build inference coordinator + session state
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

    // Apply initial auction (pre-fills opening bids for practice focus)
    if let Some(ref initial_auction) = drill_bundle.initial_auction {
        initialize_auction(&mut state, initial_auction, &HashMap::new());
    }

    // 8. Build seat strategies
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

    Ok(DrillSetupResult {
        state,
        seat_strategies,
        drill_config,
    })
}
