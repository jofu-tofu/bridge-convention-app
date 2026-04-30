//! Bundle resolution — looks up convention bundles and assembles derived data.
//!
//! Resolves a bundle ID into convention spec, surface groups, deal constraints,
//! and convention config needed by the drill lifecycle.

use std::collections::HashMap;

use bridge_conventions::registry::bundle_registry::{list_bundle_inputs, resolve_bundle};
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::module_types::PracticeRole as ModulePracticeRole;
use bridge_conventions::BaseSystemId;
use bridge_conventions::BundleInput;
use bridge_session::types::PracticeRole;

use crate::error::ServiceError;
use crate::response_types::ConventionInfo;

fn map_default_role(role: ModulePracticeRole) -> PracticeRole {
    match role {
        ModulePracticeRole::Responder => PracticeRole::Responder,
        ModulePracticeRole::Opener => PracticeRole::Opener,
        ModulePracticeRole::Both => PracticeRole::Both,
    }
}

// ── Bundle lookup ────────────────────────────────────────────────

/// Look up a bundle input by ID or return a ServiceError.
pub(crate) fn get_bundle_input(convention_id: &str) -> Result<BundleInput, ServiceError> {
    bridge_conventions::registry::get_bundle_input(convention_id)
        .ok_or_else(|| ServiceError::BundleNotFound(convention_id.to_string()))
        .cloned()
}

// ── Surface groups ───────────────────────────────────────────────

/// Resolve a bundle's derived surface groups.
pub(crate) fn resolve_surface_groups(
    convention_id: &str,
    system: BaseSystemId,
) -> Vec<SurfaceGroup> {
    resolve_bundle(convention_id, system)
        .map(|b| b.derived_teaching.surface_groups.clone())
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
            let default_role = b
                .member_ids
                .first()
                .and_then(|module_id| {
                    bridge_conventions::registry::get_module(module_id, BaseSystemId::Sayc)
                })
                .map(|module| map_default_role(module.default_role))
                .unwrap_or_else(|| {
                    panic!(
                        "Bundle '{}' must have a primary member module to derive defaultRole",
                        b.id
                    )
                });
            ConventionInfo {
                id: b.id.clone(),
                name: b.name.clone(),
                description: b.description.clone(),
                category: format!("{:?}", b.category),
                default_role,
                module_ids: b.member_ids.clone(),
                module_descriptions,
                teaching: b.teaching.clone(),
            }
        })
        .collect()
}
