//! Entry condition helpers — maps module capabilities to entry condition
//! labels for the learning viewport (e.g., "Partner opened 1NT").

use std::collections::HashMap;

use bridge_conventions::registry::bundle_registry::list_bundle_inputs;
use bridge_engine::types::{BidSuit, Call};
use serde::{Deserialize, Serialize};

// ── DTOs ─────────────────────────────────────────────────────────────

/// Entry condition for module root.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryCondition {
    pub label: String,
    pub call: Option<Call>,
    pub turn: Option<String>,
}

// ── Capability -> entry condition mapping ────────────────────────────

/// Capability -> entry condition mapping.
fn cap_entry_conditions() -> HashMap<&'static str, EntryCondition> {
    let mut map = HashMap::new();
    map.insert(
        "opening.1nt",
        EntryCondition {
            label: "Partner opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.major",
        EntryCondition {
            label: "Partner opened a major".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.weak-two",
        EntryCondition {
            label: "Partner opened a weak two".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opponent.1nt",
        EntryCondition {
            label: "Opponent opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: None,
        },
    );
    map
}

/// Get the primary capability key from declared capabilities.
fn get_primary_capability(
    declared_capabilities: Option<&HashMap<String, String>>,
) -> Option<String> {
    let caps = declared_capabilities?;
    caps.keys().next().cloned()
}

/// Derive full entry condition from the module's host capability.
pub fn derive_entry_condition(module_id: &str) -> Option<EntryCondition> {
    let conditions = cap_entry_conditions();
    for input in list_bundle_inputs() {
        if !input.member_ids.iter().any(|id| id == module_id) {
            continue;
        }
        let cap_id = get_primary_capability(input.declared_capabilities.as_ref())?;
        if let Some(ec) = conditions.get(cap_id.as_str()) {
            return Some(ec.clone());
        }
    }
    None
}

/// Derive root phase label from the module's host capability.
pub fn derive_root_phase_label(module_id: &str) -> Option<String> {
    derive_entry_condition(module_id).map(|ec| ec.label)
}
