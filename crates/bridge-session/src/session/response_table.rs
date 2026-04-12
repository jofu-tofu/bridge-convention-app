//! Derived response-table rows for convention reference pages.

use std::collections::HashSet;

use bridge_conventions::rule_types::PhaseRef;
use bridge_conventions::types::meaning::{
    BidMeaning, BidMeaningClause, ConstraintValue, FactOperator,
};
use bridge_conventions::{ConventionModule, Disclosure, RecommendationBand};

use super::learning_types::ResponseTableRow;

// Shape facts explicitly routed into the response-table shape column.
// Source: primitive fact catalog in `crates/bridge-conventions/src/fact_dsl/primitives.rs`
// plus bridge-derived shape facts in `crates/bridge-conventions/src/fact_dsl/bridge_derived.rs`.
pub const SHAPE_FACT_IDS: &[&str] = &[
    "hand.isBalanced",
    "hand.suitLength.spades",
    "hand.suitLength.hearts",
    "hand.suitLength.diamonds",
    "hand.suitLength.clubs",
    "bridge.hasFourCardMajor",
    "bridge.hasFiveCardMajor",
    "bridge.majorPattern",
    "bridge.hasShortage",
    "bridge.supportForBoundSuit",
    "bridge.fitWithBoundSuit",
    "bridge.shortageInSuit",
];

// Point/HCP facts explicitly routed into the response-table HCP column.
// Source: primitive points in `fact_dsl/primitives.rs`, relational point facts in
// `fact_dsl/bridge_derived.rs`, and system thresholds in
// `crates/bridge-conventions/src/fact_dsl/system_facts.rs`.
pub const HCP_FACT_IDS: &[&str] = &[
    "hand.hcp",
    "hand.shortagePoints",
    "hand.lengthPoints",
    "bridge.totalPointsForRaise",
    "system.responder.weakHand",
    "system.responder.inviteValues",
    "system.responder.gameValues",
    "system.responder.slamValues",
    "system.opener.notMinimum",
    "system.responderTwoLevelNewSuit",
    "system.responder.oneNtRange",
    "system.dontOvercall.inRange",
];

// Forcing-signal facts explicitly routed into the response-table forcing column.
// Source: forcing-status facts in `crates/bridge-conventions/src/fact_dsl/system_facts.rs`.
pub const FORCING_FACT_IDS: &[&str] = &[
    "system.suitResponseIsGameForcing",
    "system.oneNtForcingAfterMajor",
];

pub fn build_response_table_rows(module: &ConventionModule) -> Vec<ResponseTableRow> {
    direct_response_surfaces(module)
        .into_iter()
        .map(derive_response_row)
        .collect()
}

fn direct_response_surfaces(module: &ConventionModule) -> Vec<&BidMeaning> {
    let states = match module.states.as_deref() {
        Some(states) => states,
        None => return Vec::new(),
    };

    let mut response_phases = Vec::new();
    for transition in &module.local.transitions {
        if phase_ref_contains(&transition.from, &module.local.initial)
            && !response_phases.contains(&transition.to)
        {
            response_phases.push(transition.to.clone());
        }
    }

    let mut seen = HashSet::new();
    let mut surfaces = Vec::new();
    for state in states {
        let state_phases = phase_ref_values(&state.phase);
        if !state_phases
            .iter()
            .any(|phase| response_phases.contains(phase))
        {
            continue;
        }

        for surface in &state.surfaces {
            if seen.insert(surface.meaning_id.clone()) {
                surfaces.push(surface);
            }
        }
    }

    surfaces
}

fn derive_response_row(surface: &BidMeaning) -> ResponseTableRow {
    ResponseTableRow {
        meaning_id: surface.meaning_id.clone(),
        response: surface.encoding.default_call.clone(),
        meaning: if surface.teaching_label.summary.as_str().is_empty() {
            surface.teaching_label.name.as_str().to_string()
        } else {
            surface.teaching_label.summary.as_str().to_string()
        },
        shape: render_column(&surface.clauses, SHAPE_FACT_IDS),
        hcp: render_column(&surface.clauses, HCP_FACT_IDS),
        forcing: render_forcing(surface),
    }
}

fn render_column(clauses: &[BidMeaningClause], fact_ids: &[&str]) -> String {
    clauses
        .iter()
        .filter(|clause| fact_ids.contains(&clause.fact_id.as_str()))
        .map(render_clause)
        .collect::<Vec<_>>()
        .join("; ")
}

fn render_forcing(surface: &BidMeaning) -> String {
    let forcing_from_facts = surface
        .clauses
        .iter()
        .find(|clause| FORCING_FACT_IDS.contains(&clause.fact_id.as_str()))
        .and_then(map_forcing_clause);
    if let Some(token) = forcing_from_facts {
        return token.to_string();
    }

    // Current fixtures do not encode forcing directly in disclosure/recommendation.
    // Keep the mapping explicit and fail blank rather than inventing labels.
    match (surface.disclosure, surface.ranking.recommendation_band) {
        (Disclosure::Announcement, RecommendationBand::Must) => "F1".to_string(),
        (Disclosure::Announcement, RecommendationBand::Should) => "INV".to_string(),
        _ => String::new(),
    }
}

fn map_forcing_clause(clause: &BidMeaningClause) -> Option<&'static str> {
    match clause.fact_id.as_str() {
        "system.suitResponseIsGameForcing" => match clause.value {
            ConstraintValue::Bool(true) => Some("GF"),
            ConstraintValue::Bool(false) => Some("NF"),
            _ => None,
        },
        "system.oneNtForcingAfterMajor" => match &clause.value {
            ConstraintValue::String(value) if value == "forcing" => Some("F1"),
            ConstraintValue::String(value) if value == "semi-forcing" => Some("F1"),
            ConstraintValue::String(value) if value == "non-forcing" => Some("NF"),
            _ => None,
        },
        _ => None,
    }
}

fn render_clause(clause: &BidMeaningClause) -> String {
    clause
        .description
        .as_ref()
        .cloned()
        .unwrap_or_else(|| fallback_clause_text(clause))
}

fn fallback_clause_text(clause: &BidMeaningClause) -> String {
    match clause.operator {
        FactOperator::Boolean => match &clause.value {
            ConstraintValue::Bool(true) => clause.fact_id.clone(),
            ConstraintValue::Bool(false) => format!("not {}", clause.fact_id),
            _ => clause.fact_id.clone(),
        },
        FactOperator::Gte => format!("{} >= {}", clause.fact_id, constraint_value(&clause.value)),
        FactOperator::Lte => format!("{} <= {}", clause.fact_id, constraint_value(&clause.value)),
        FactOperator::Eq => format!("{} = {}", clause.fact_id, constraint_value(&clause.value)),
        FactOperator::Range => format!("{} {}", clause.fact_id, constraint_value(&clause.value)),
        FactOperator::In => format!("{} in {}", clause.fact_id, constraint_value(&clause.value)),
    }
}

fn constraint_value(value: &ConstraintValue) -> String {
    match value {
        ConstraintValue::Number(n) => n.to_string(),
        ConstraintValue::Bool(b) => b.to_string(),
        ConstraintValue::String(s) => s.clone(),
        ConstraintValue::Range { min, max } => format!("{min}-{max}"),
        ConstraintValue::List(items) => items.join(", "),
    }
}

fn phase_ref_contains(phase_ref: &PhaseRef, value: &str) -> bool {
    phase_ref_values(phase_ref)
        .iter()
        .any(|phase| phase == value)
}

fn phase_ref_values(phase_ref: &PhaseRef) -> Vec<String> {
    match phase_ref {
        PhaseRef::Single(value) => vec![value.clone()],
        PhaseRef::Multiple(values) => values.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::registry::module_registry::get_module;
    use bridge_conventions::types::authored_text::{BidName, BidSummary, TeachingLabel};
    use bridge_conventions::types::meaning::{
        AuthoredRankingMetadata, BidEncoding, ConstraintValue, FactOperator, SourceIntent,
    };
    use bridge_conventions::{BaseSystemId, Disclosure, RecommendationBand};
    use bridge_engine::types::{BidSuit, Call};
    use std::collections::HashMap;

    fn stayman_response_surface(index: usize) -> BidMeaning {
        let module = get_module("stayman", BaseSystemId::Sayc).unwrap();
        direct_response_surfaces(module)[index].clone()
    }

    fn surface_with_clauses(clauses: Vec<BidMeaningClause>) -> BidMeaning {
        BidMeaning {
            meaning_id: "test:surface".to_string(),
            semantic_class_id: "test:surface".to_string(),
            module_id: Some("test".to_string()),
            encoding: BidEncoding {
                default_call: Call::Bid {
                    level: 2,
                    strain: BidSuit::Diamonds,
                },
                alternate_encodings: None,
            },
            clauses,
            ranking: AuthoredRankingMetadata {
                recommendation_band: RecommendationBand::Should,
                module_precedence: None,
                declaration_order: 0,
            },
            source_intent: SourceIntent {
                intent_type: "Test".to_string(),
                params: HashMap::new(),
            },
            disclosure: Disclosure::Standard,
            teaching_label: TeachingLabel {
                name: BidName::new("Test"),
                summary: BidSummary::new("Synthetic response row"),
            },
            surface_bindings: None,
        }
    }

    #[test]
    fn stayman_response_phase_produces_expected_three_rows() {
        let module = get_module("stayman", BaseSystemId::Sayc).unwrap();
        let rows = build_response_table_rows(module);

        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].meaning_id, "stayman:show-hearts");
        assert_eq!(rows[0].shape, "4+ hearts");
        assert_eq!(rows[0].hcp, "");

        assert_eq!(rows[1].meaning_id, "stayman:show-spades");
        assert_eq!(
            rows[1].shape,
            "4+ spades; At most 3 hearts (show hearts first with both)"
        );

        assert_eq!(rows[2].meaning_id, "stayman:deny-major");
        assert_eq!(rows[2].shape, "No 4-card major");
    }

    #[test]
    fn unknown_fact_ids_are_ignored_without_panic() {
        let mut surface = stayman_response_surface(0);
        surface.clauses.push(BidMeaningClause {
            fact_id: "module.test.unknown".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            clause_id: None,
            description: Some("Should be ignored".to_string()),
            rationale: None,
            is_public: Some(true),
        });

        let row = derive_response_row(&surface);
        assert_eq!(row.shape, "4+ hearts");
    }

    #[test]
    fn surface_with_no_hcp_clause_renders_empty_hcp_cell() {
        let row = derive_response_row(&surface_with_clauses(vec![BidMeaningClause {
            fact_id: "hand.suitLength.hearts".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(4),
            clause_id: None,
            description: Some("4+ hearts".to_string()),
            rationale: None,
            is_public: Some(true),
        }]));

        assert_eq!(row.hcp, "");
    }
}
