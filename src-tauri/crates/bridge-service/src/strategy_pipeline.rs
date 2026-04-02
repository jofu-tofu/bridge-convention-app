//! Strategy pipeline helpers — fact evaluation, vulnerability context,
//! explanation extraction, and alternative/near-miss call extraction.

use std::collections::HashMap;

use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::fact_dsl::types::FactValue;
use bridge_conventions::fact_dsl::FactData;
use bridge_engine::scoring::is_vulnerable;
use bridge_engine::types::{Call, Seat, Vulnerability};

/// Extract the teaching label from the evaluation's selected carrier.
pub(crate) fn extract_explanation(evaluation: &StrategyEvaluation) -> String {
    evaluation
        .pipeline_result
        .as_ref()
        .and_then(|pr| pr.selected.as_ref())
        .map(|c| c.proposal().teaching_label.name.to_string())
        .unwrap_or_else(|| "Convention bid".to_string())
}

/// Extract alternative calls from the pipeline evaluation.
/// truth_set_calls = other calls in truth_set (excluding selected).
/// acceptable_set_calls = calls in acceptable_set not already in truth_set.
pub(crate) fn extract_alternative_calls(
    evaluation: &StrategyEvaluation,
    selected_call: &Call,
) -> (Vec<Call>, Vec<Call>) {
    let pr = match &evaluation.pipeline_result {
        Some(pr) => pr,
        None => return (Vec::new(), Vec::new()),
    };
    let truth_set_calls: Vec<Call> = pr
        .truth_set
        .iter()
        .map(|c| c.call().clone())
        .filter(|c| c != selected_call)
        .collect();
    let acceptable_set_calls: Vec<Call> = pr
        .acceptable_set
        .iter()
        .map(|c| c.call().clone())
        .filter(|c| c != selected_call && !truth_set_calls.contains(c))
        .collect();
    (truth_set_calls, acceptable_set_calls)
}

/// Extract near-miss calls: eliminated candidates in the same surface group
/// as the selected bid with at most one unsatisfied clause.
pub(crate) fn extract_near_miss_calls(
    evaluation: &StrategyEvaluation,
    selected_call: &Call,
) -> Vec<Call> {
    let pr = match &evaluation.pipeline_result {
        Some(pr) => pr,
        None => return Vec::new(),
    };
    let selected = match &pr.selected {
        Some(s) => s,
        None => return Vec::new(),
    };
    let groups = match &evaluation.surface_groups {
        Some(g) => g,
        None => return Vec::new(),
    };
    let selected_meaning_id = &selected.proposal().meaning_id;
    let group = groups.iter().find(|g| {
        g.members.iter().any(|m| m == selected_meaning_id.as_str())
    });
    let group = match group {
        Some(g) => g,
        None => return Vec::new(),
    };

    let mut calls = Vec::new();
    for c in &pr.eliminated {
        let failed = c.proposal().clauses.iter().filter(|cl| !cl.satisfied).count();
        if failed == 1
            && group.members.iter().any(|m| m == &c.proposal().meaning_id)
            && c.call() != selected_call
            && !calls.contains(c.call())
        {
            calls.push(c.call().clone());
        }
    }
    calls
}

/// Build vulnerability facts for pipeline evaluation.
pub(crate) fn vulnerability_facts(
    vulnerability: Option<Vulnerability>,
    seat: Seat,
) -> Option<HashMap<String, FactValue>> {
    match vulnerability {
        Some(v) if is_vulnerable(seat, v) => {
            let mut map = HashMap::new();
            map.insert(
                "bridge.isVulnerable".to_string(),
                FactValue {
                    fact_id: "bridge.isVulnerable".to_string(),
                    value: FactData::Boolean(true),
                },
            );
            Some(map)
        }
        _ => None,
    }
}
