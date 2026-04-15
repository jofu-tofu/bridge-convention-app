//! Derived response-table for convention reference pages.
//!
//! Columns are discovered from surface clauses rather than authored: for each
//! fact id referenced by a response surface, `classify_fact_id` buckets it
//! into one of `shape` / `hcp` / `forcing` / `other`. Columns are emitted in
//! first-seen declaration order.

use std::collections::HashSet;

use bridge_conventions::rule_types::PhaseRef;
use bridge_conventions::types::meaning::{
    BidMeaning, BidMeaningClause, ConstraintValue, FactOperator,
};
use bridge_conventions::{ConventionModule, Disclosure, RecommendationBand};

use super::learning_types::{
    ResponseTable, ResponseTableCell, ResponseTableColumn, ResponseTableRow,
};

/// Classify a clause fact id into a response-table column.
///
/// Returns `(column_id, column_label)`. Unknown fact ids fall through to
/// `("other", "Other")`. Bucket membership mirrors the stage-2 constants;
/// changing the returned tuple here is the single point of schema drift.
pub fn classify_fact_id(fact_id: &str) -> (&'static str, &'static str) {
    match fact_id {
        // Shape bucket — primitive shape facts plus bridge-derived shape facts.
        "hand.isBalanced"
        | "hand.suitLength.spades"
        | "hand.suitLength.hearts"
        | "hand.suitLength.diamonds"
        | "hand.suitLength.clubs"
        | "bridge.hasFourCardMajor"
        | "bridge.hasFiveCardMajor"
        | "bridge.majorPattern"
        | "bridge.hasShortage"
        | "bridge.supportForBoundSuit"
        | "bridge.fitWithBoundSuit"
        | "bridge.shortageInSuit" => ("shape", "Shape"),

        // HCP/points bucket — primitive points, relational points, system thresholds.
        "hand.hcp"
        | "hand.shortagePoints"
        | "hand.lengthPoints"
        | "bridge.totalPointsForRaise"
        | "system.responder.weakHand"
        | "system.responder.inviteValues"
        | "system.responder.gameValues"
        | "system.responder.slamValues"
        | "system.opener.notMinimum"
        | "system.responderTwoLevelNewSuit"
        | "system.responder.oneNtRange"
        | "system.dontOvercall.inRange"
        | "system.opening.weakTwoRange"
        | "system.opening.strong2cRange" => ("hcp", "HCP"),

        // Forcing-signal bucket.
        "system.suitResponseIsGameForcing" | "system.oneNtForcingAfterMajor" => {
            ("forcing", "Forcing")
        }

        _ => ("other", "Other"),
    }
}

pub fn build_response_table(module: &ConventionModule) -> ResponseTable {
    let surfaces = direct_response_surfaces(module);

    // ── Pass 1 + 2: column discovery via first-seen fact-id order ───────
    let mut columns: Vec<ResponseTableColumn> = Vec::new();
    let mut seen_col_ids: HashSet<&'static str> = HashSet::new();
    let mut has_forcing_column = false;

    for surface in &surfaces {
        for clause in &surface.clauses {
            let (col_id, col_label) = classify_fact_id(clause.fact_id.as_str());
            if seen_col_ids.insert(col_id) {
                columns.push(ResponseTableColumn {
                    id: col_id.to_string(),
                    label: col_label.to_string(),
                });
            }
        }
        // Ensure a forcing column exists for any surface that qualifies for the
        // Announcement+Must → F1 fallback, even if no forcing clause was authored.
        if !has_forcing_column
            && forcing_fallback_applies(surface)
            && seen_col_ids.insert("forcing")
        {
            columns.push(ResponseTableColumn {
                id: "forcing".to_string(),
                label: "Forcing".to_string(),
            });
            has_forcing_column = true;
        } else if seen_col_ids.contains("forcing") {
            has_forcing_column = true;
        }
    }

    // ── Pass 3: render cells per (surface, column) ──────────────────────
    let rows = surfaces
        .into_iter()
        .map(|surface| derive_row(surface, &columns))
        .collect();

    ResponseTable { columns, rows }
}

fn derive_row(surface: &BidMeaning, columns: &[ResponseTableColumn]) -> ResponseTableRow {
    let cells = columns
        .iter()
        .map(|column| ResponseTableCell {
            column_id: column.id.clone(),
            column_label: column.label.clone(),
            text: render_column_text(surface, column.id.as_str()),
        })
        .collect();

    ResponseTableRow {
        meaning_id: surface.meaning_id.clone(),
        response: surface.encoding.default_call.clone(),
        meaning: if surface.teaching_label.summary.as_str().is_empty() {
            surface.teaching_label.name.as_str().to_string()
        } else {
            surface.teaching_label.summary.as_str().to_string()
        },
        cells,
    }
}

fn render_column_text(surface: &BidMeaning, column_id: &str) -> String {
    if column_id == "forcing" {
        return render_forcing(surface);
    }

    let parts: Vec<String> = surface
        .clauses
        .iter()
        .filter(|clause| classify_fact_id(clause.fact_id.as_str()).0 == column_id)
        .map(render_clause)
        .collect();
    parts.join("; ")
}

fn render_forcing(surface: &BidMeaning) -> String {
    let forcing_from_facts = surface
        .clauses
        .iter()
        .find(|clause| classify_fact_id(clause.fact_id.as_str()).0 == "forcing")
        .and_then(map_forcing_clause);
    if let Some(token) = forcing_from_facts {
        return token.to_string();
    }

    if forcing_fallback_applies(surface) {
        return "F1".to_string();
    }
    match (surface.disclosure, surface.ranking.recommendation_band) {
        (Disclosure::Announcement, RecommendationBand::Should) => "INV".to_string(),
        _ => String::new(),
    }
}

fn forcing_fallback_applies(surface: &BidMeaning) -> bool {
    matches!(
        (surface.disclosure, surface.ranking.recommendation_band),
        (Disclosure::Announcement, RecommendationBand::Must)
    )
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

    fn find_cell<'a>(row: &'a ResponseTableRow, column_id: &str) -> &'a ResponseTableCell {
        row.cells
            .iter()
            .find(|c| c.column_id == column_id)
            .unwrap_or_else(|| panic!("row {} has no '{}' cell", row.meaning_id, column_id))
    }

    fn cell_text<'a>(row: &'a ResponseTableRow, column_id: &str) -> &'a str {
        row.cells
            .iter()
            .find(|c| c.column_id == column_id)
            .map(|c| c.text.as_str())
            .unwrap_or("")
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
        let table = build_response_table(module);
        let rows = &table.rows;

        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].meaning_id, "stayman:show-hearts");
        assert_eq!(cell_text(&rows[0], "shape"), "4+ hearts");

        assert_eq!(rows[1].meaning_id, "stayman:show-spades");
        assert_eq!(
            cell_text(&rows[1], "shape"),
            "4+ spades; At most 3 hearts (show hearts first with both)"
        );

        assert_eq!(rows[2].meaning_id, "stayman:deny-major");
        assert_eq!(cell_text(&rows[2], "shape"), "No 4-card major");

        // Columns should include at least 'shape' and be in first-seen order.
        assert_eq!(table.columns.first().map(|c| c.id.as_str()), Some("shape"));
    }

    #[test]
    fn unknown_fact_ids_are_routed_to_other_column() {
        let module = get_module("stayman", BaseSystemId::Sayc).unwrap();
        let mut surface = direct_response_surfaces(module)[0].clone();
        surface.clauses.push(BidMeaningClause {
            fact_id: "module.test.unknown".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            clause_id: None,
            description: Some("Should appear in Other column".to_string()),
            rationale: None,
            is_public: Some(true),
        });

        let row = derive_row(
            &surface,
            &[
                ResponseTableColumn {
                    id: "shape".to_string(),
                    label: "Shape".to_string(),
                },
                ResponseTableColumn {
                    id: "other".to_string(),
                    label: "Other".to_string(),
                },
            ],
        );

        assert_eq!(cell_text(&row, "shape"), "4+ hearts");
        assert_eq!(cell_text(&row, "other"), "Should appear in Other column");
    }

    #[test]
    fn unbucketed_fact_ids_surface_as_other_column() {
        // Fabricated fact id that is NOT in classify_fact_id's known buckets.
        let surface = surface_with_clauses(vec![BidMeaningClause {
            fact_id: "bridge.keyCards".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(3),
            clause_id: None,
            description: Some("3+ key cards".to_string()),
            rationale: None,
            is_public: Some(true),
        }]);

        let (col_id, col_label) = classify_fact_id("bridge.keyCards");
        assert_eq!(col_id, "other");
        assert_eq!(col_label, "Other");

        // Simulate the pass-1 discovery for a single-surface table.
        let columns = vec![ResponseTableColumn {
            id: col_id.to_string(),
            label: col_label.to_string(),
        }];
        let row = derive_row(&surface, &columns);
        assert_eq!(row.cells.len(), 1);
        let cell = find_cell(&row, "other");
        assert_eq!(cell.column_id, "other");
        assert_eq!(cell.column_label, "Other");
        assert_eq!(cell.text, "3+ key cards");
    }

    #[test]
    fn surface_with_no_hcp_clause_renders_empty_hcp_cell() {
        let surface = surface_with_clauses(vec![BidMeaningClause {
            fact_id: "hand.suitLength.hearts".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(4),
            clause_id: None,
            description: Some("4+ hearts".to_string()),
            rationale: None,
            is_public: Some(true),
        }]);

        let columns = vec![
            ResponseTableColumn {
                id: "shape".to_string(),
                label: "Shape".to_string(),
            },
            ResponseTableColumn {
                id: "hcp".to_string(),
                label: "HCP".to_string(),
            },
        ];
        let row = derive_row(&surface, &columns);
        assert_eq!(cell_text(&row, "hcp"), "");
        assert_eq!(cell_text(&row, "shape"), "4+ hearts");
    }
}
