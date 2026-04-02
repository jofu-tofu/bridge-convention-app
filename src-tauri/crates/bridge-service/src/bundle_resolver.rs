//! Bundle resolution — looks up convention bundles and assembles derived data.
//!
//! Resolves a bundle ID into convention spec, surface groups, deal constraints,
//! and convention config needed by the drill lifecycle.

use std::collections::HashMap;

use bridge_conventions::registry::bundle_registry::{list_bundle_inputs, resolve_bundle};
use bridge_conventions::BundleInput;
use bridge_conventions::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
use bridge_conventions::types::teaching::SurfaceGroupRelationship as BundleSGRelationship;
use bridge_conventions::BaseSystemId;
use bridge_engine::types::{DealConstraints, Seat, Vulnerability};
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

/// Build a `ConventionConfig` from a bundle ID, merging bundle deal constraints
/// with caller overrides for vulnerability, seed, and max_attempts.
pub(crate) fn build_convention_config(
    convention_id: &str,
    system: BaseSystemId,
    vulnerability_override: Option<Vulnerability>,
    seed: Option<u64>,
) -> ConventionConfig {
    let resolved = resolve_bundle(convention_id, system);

    let bundle_constraints = resolved
        .map(|b| b.deal_constraints.clone())
        .unwrap_or_else(|| DealConstraints {
            seats: vec![],
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: None,
            seed: None,
        });

    ConventionConfig {
        id: convention_id.to_string(),
        deal_constraints: DealConstraints {
            vulnerability: vulnerability_override,
            max_attempts: Some(50_000),
            seed,
            ..bundle_constraints
        },
        allowed_dealers: resolved.and_then(|b| b.allowed_dealers.clone()),
        off_convention_constraints: resolved.and_then(|b| b.off_convention_constraints.clone()),
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
                category: format!("{:?}", b.category).to_lowercase(),
                module_ids: b.member_ids.clone(),
                module_descriptions,
                teaching: b.teaching.clone(),
            }
        })
        .collect()
}
