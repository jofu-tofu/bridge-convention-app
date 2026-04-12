//! Bundle resolution — looks up convention bundles and assembles derived data.
//!
//! Resolves a bundle ID into convention spec, surface groups, deal constraints,
//! and convention config needed by the drill lifecycle.

use std::collections::HashMap;

use bridge_conventions::registry::bundle_registry::{list_bundle_inputs, resolve_bundle};
use bridge_conventions::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
use bridge_conventions::types::teaching::SurfaceGroupRelationship as BundleSGRelationship;
use bridge_conventions::BaseSystemId;
use bridge_conventions::BundleInput;

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
