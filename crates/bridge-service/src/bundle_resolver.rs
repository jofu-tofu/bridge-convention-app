//! Bundle resolution — looks up convention bundles and assembles derived data.
//!
//! Resolves a bundle ID into convention spec, surface groups, deal constraints,
//! and convention config needed by the drill lifecycle.

use std::collections::HashMap;

use bridge_conventions::fact_dsl::derive_deal_constraints;
use bridge_conventions::registry::bundle_registry::{list_bundle_inputs, resolve_bundle};
use bridge_conventions::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
use bridge_conventions::types::teaching::SurfaceGroupRelationship as BundleSGRelationship;
use bridge_conventions::BaseSystemId;
use bridge_conventions::BundleInput;
use bridge_engine::types::{DealConstraints, Seat, SeatConstraint, Vulnerability};
use bridge_session::session::start_drill::ConventionConfig;

use crate::error::ServiceError;
use crate::response_types::ConventionInfo;

// ── Bundle lookup ────────────────────────────────────────────────

/// Look up a bundle input by ID or return a ServiceError.
pub(crate) fn get_bundle_input(convention_id: &str) -> Result<BundleInput, ServiceError> {
    bridge_conventions::registry::get_bundle_input(convention_id)
        .ok_or_else(|| ServiceError::BundleNotFound(convention_id.to_string()))
        .cloned()
}

// ── Surface groups ───────────────────────────────────────────────

/// Convert bundle-level SurfaceGroups into teaching SurfaceGroups.
pub(crate) fn resolve_surface_groups(
    convention_id: &str,
    system: BaseSystemId,
) -> Vec<SurfaceGroup> {
    let resolved = resolve_bundle(convention_id, system);
    resolved
        .map(|b| {
            b.derived_teaching
                .surface_groups
                .iter()
                .map(|sg| SurfaceGroup {
                    id: sg.id.clone(),
                    label: sg.label.clone(),
                    members: sg.members.clone(),
                    relationship: match sg.relationship {
                        BundleSGRelationship::MutuallyExclusive => {
                            SurfaceGroupRelationship::MutuallyExclusive
                        }
                        BundleSGRelationship::EquivalentEncoding => {
                            SurfaceGroupRelationship::EquivalentEncoding
                        }
                        BundleSGRelationship::PolicyAlternative => {
                            SurfaceGroupRelationship::PolicyAlternative
                        }
                    },
                    description: sg.description.clone(),
                })
                .collect()
        })
        .unwrap_or_default()
}

// ── Convention config ────────────────────────────────────────────

/// Scan bundle module attachments for an auction-start "1NT" trigger and, if
/// present, synthesize a seat constraint forcing the trigger seat (the single
/// `allowedDealers` entry) to be a 15-17 HCP balanced hand. Required because
/// the fact-inverter derives no constraints from attachment-driven activation,
/// so without this synthesis e.g. DONT would be dealt random RHO hands that
/// never open 1NT. Returns the synthesized seat (if any) so the caller can
/// merge it with any existing derived constraints.
fn synthesize_nt_opener_seat_constraint(
    bundle: &bridge_conventions::types::ConventionBundle,
    system: BaseSystemId,
) -> Option<SeatConstraint> {
    use bridge_conventions::registry::system_configs::get_system_config;
    use bridge_conventions::types::agreement::AuctionPattern;

    let profile = bundle.system_profile.as_ref()?;
    let triggers_on_1nt = profile.modules.iter().flat_map(|m| &m.attachments).any(|a| {
        matches!(
            a.when_auction.as_ref(),
            Some(AuctionPattern::Sequence { calls })
                if calls.len() == 1 && calls[0] == "1NT"
        )
    });
    if !triggers_on_1nt {
        return None;
    }

    // Require exactly one allowed dealer (the opener seat).
    let seat = match bundle.allowed_dealers.as_deref() {
        Some([seat]) => *seat,
        _ => return None,
    };

    let system_config = get_system_config(system);
    let nt_min = system_config.nt_opening.min_hcp;
    let nt_max = system_config.nt_opening.max_hcp;

    Some(SeatConstraint {
        seat,
        min_hcp: Some(nt_min),
        max_hcp: Some(nt_max),
        balanced: Some(true),
        min_length: None,
        max_length: None,
        min_length_any: None,
    })
}

/// Build a `ConventionConfig` from a bundle ID, merging bundle deal constraints
/// with caller overrides for vulnerability, seed, and max_attempts.
pub(crate) fn build_convention_config(
    convention_id: &str,
    system: BaseSystemId,
    vulnerability_override: Option<Vulnerability>,
    seed: Option<u64>,
) -> ConventionConfig {
    let resolved = resolve_bundle(convention_id, system);

    let mut bundle_constraints = resolved
        .map(|b| derive_deal_constraints(b, system))
        .unwrap_or_else(|| DealConstraints {
            seats: vec![],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        });

    // Synthesize the opener seat constraint for attachment-driven bundles like
    // DONT, where the inverter alone wouldn't force RHO into a 1NT-opening hand.
    if let Some(bundle) = resolved {
        if let Some(synth) = synthesize_nt_opener_seat_constraint(bundle, system) {
            // Replace any existing constraint for the same seat with the
            // synthesized one (tighter 15-17 balanced beats the loose default).
            bundle_constraints.seats.retain(|sc| sc.seat != synth.seat);
            bundle_constraints.seats.push(synth);
        }
    }

    ConventionConfig {
        id: convention_id.to_string(),
        deal_constraints: DealConstraints {
            vulnerability: vulnerability_override,
            max_attempts: Some(50_000),
            seed,
            ..bundle_constraints
        },
        allowed_dealers: resolved.and_then(|b| b.allowed_dealers.clone()),
    }
}

// ── Convention listing ───────────────────────────────────────────

/// Build the public convention list from the bundle registry.
pub(crate) fn list_conventions() -> Vec<ConventionInfo> {
    let bundles = list_bundle_inputs();
    bundles
        .iter()
        .filter(|b| b.internal != Some(true))
        .map(|b| {
            let module_descriptions = resolve_bundle(&b.id, BaseSystemId::Sayc).map(|bundle| {
                bundle
                    .modules
                    .iter()
                    .map(|m| (m.module_id.clone(), m.description.to_string()))
                    .collect::<HashMap<String, String>>()
            });
            ConventionInfo {
                id: b.id.clone(),
                name: b.name.clone(),
                description: b.description.clone(),
                category: format!("{:?}", b.category),
                module_ids: b.member_ids.clone(),
                module_descriptions,
                teaching: b.teaching.clone(),
            }
        })
        .collect()
}
