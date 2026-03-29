//! Parse tree builder — builds ParseTreeView from PipelineResult.
//!
//! Mirrors TS from `conventions/teaching/parse-tree-builder.ts`.

use std::collections::HashMap;

use crate::pipeline::types::PipelineResult;
use crate::teaching::teaching_types::*;

/// Build a parse tree view from a PipelineResult.
pub fn build_parse_tree(result: &PipelineResult) -> ParseTreeView {
    let mut module_nodes: HashMap<String, ParseTreeModuleNode> = HashMap::new();

    // Process truth set carriers (selected + applicable)
    for carrier in &result.truth_set {
        let module_id = &carrier.proposal().module_id;
        let node = module_nodes.entry(module_id.clone()).or_insert_with(|| {
            ParseTreeModuleNode {
                module_id: module_id.clone(),
                display_label: module_id.clone(),
                verdict: ParseTreeModuleVerdict::Applicable,
                conditions: Vec::new(),
                meanings: Vec::new(),
                elimination_reason: None,
            }
        });

        node.meanings.push(ParseTreeMeaning {
            meaning_id: carrier.proposal().meaning_id.clone(),
            display_label: carrier.proposal().teaching_label.name.to_string(),
            matched: carrier.encoded.eligibility.hand.satisfied,
            call: Some(carrier.call().clone()),
        });
    }

    // Process eliminated carriers
    for carrier in &result.eliminated {
        let module_id = &carrier.proposal().module_id;
        let node = module_nodes.entry(module_id.clone()).or_insert_with(|| {
            ParseTreeModuleNode {
                module_id: module_id.clone(),
                display_label: module_id.clone(),
                verdict: ParseTreeModuleVerdict::Eliminated,
                conditions: Vec::new(),
                meanings: Vec::new(),
                elimination_reason: carrier
                    .traces
                    .elimination
                    .as_ref()
                    .map(|e| e.reason.clone()),
            }
        });

        // Add conditions from failed clauses
        for clause in &carrier.proposal().clauses {
            if !clause.satisfied {
                node.conditions.push(ParseTreeCondition {
                    fact_id: clause.fact_id.clone(),
                    description: clause
                        .description
                        .clone()
                        .unwrap_or_else(|| clause.fact_id.clone()),
                    satisfied: false,
                    observed_value: clause.observed_value.clone(),
                });
            }
        }

        node.meanings.push(ParseTreeMeaning {
            meaning_id: carrier.proposal().meaning_id.clone(),
            display_label: carrier.proposal().teaching_label.name.to_string(),
            matched: false,
            call: Some(carrier.call().clone()),
        });
    }

    // Mark selected module
    if let Some(ref selected) = result.selected {
        if let Some(node) = module_nodes.get_mut(&selected.proposal().module_id) {
            node.verdict = ParseTreeModuleVerdict::Selected;
        }
    }

    // Build selected path
    let selected_path = result.selected.as_ref().map(|s| SelectedPath {
        module_id: s.proposal().module_id.clone(),
        meaning_id: s.proposal().meaning_id.clone(),
        call: s.call().clone(),
    });

    // Sort modules: selected first, then applicable, then eliminated
    let mut modules: Vec<ParseTreeModuleNode> = module_nodes.into_values().collect();
    modules.sort_by_key(|m| match m.verdict {
        ParseTreeModuleVerdict::Selected => 0,
        ParseTreeModuleVerdict::Applicable => 1,
        ParseTreeModuleVerdict::Eliminated => 2,
    });

    ParseTreeView {
        modules,
        selected_path,
    }
}
