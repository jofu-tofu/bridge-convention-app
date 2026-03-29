//! Topological sort for fact definitions.
//!
//! DFS post-order traversal walking `derives_from` edges,
//! ensuring dependencies are evaluated before dependents.

use std::collections::{HashMap, HashSet};

use crate::types::FactDefinition;

/// Sort fact definitions in dependency order (dependencies first).
pub fn topological_sort(definitions: &[FactDefinition]) -> Vec<&FactDefinition> {
    let by_id: HashMap<&str, &FactDefinition> = definitions
        .iter()
        .map(|d| (d.id.as_str(), d))
        .collect();

    let mut visited = HashSet::new();
    let mut sorted = Vec::with_capacity(definitions.len());

    for def in definitions {
        visit(&def.id, &by_id, &mut visited, &mut sorted);
    }

    sorted
}

fn visit<'a>(
    id: &str,
    by_id: &HashMap<&str, &'a FactDefinition>,
    visited: &mut HashSet<String>,
    sorted: &mut Vec<&'a FactDefinition>,
) {
    if visited.contains(id) {
        return;
    }
    visited.insert(id.to_string());

    if let Some(def) = by_id.get(id) {
        if let Some(deps) = &def.derives_from {
            for dep in deps {
                visit(dep, by_id, visited, sorted);
            }
        }
        sorted.push(def);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{FactLayer, EvaluationWorld, FactValueType};

    fn make_def(id: &str, derives_from: Option<Vec<&str>>) -> FactDefinition {
        FactDefinition {
            id: id.to_string(),
            layer: FactLayer::ModuleDerived,
            world: EvaluationWorld::ActingHand,
            description: String::new(),
            value_type: FactValueType::Boolean,
            derives_from: derives_from.map(|v| v.into_iter().map(String::from).collect()),
            constrains_dimensions: vec![],
            composition: None,
        }
    }

    #[test]
    fn sorts_dependencies_first() {
        let defs = vec![
            make_def("c", Some(vec!["a", "b"])),
            make_def("a", None),
            make_def("b", Some(vec!["a"])),
        ];
        let sorted = topological_sort(&defs);
        let ids: Vec<&str> = sorted.iter().map(|d| d.id.as_str()).collect();
        assert_eq!(ids, vec!["a", "b", "c"]);
    }

    #[test]
    fn handles_no_dependencies() {
        let defs = vec![
            make_def("x", None),
            make_def("y", None),
        ];
        let sorted = topological_sort(&defs);
        assert_eq!(sorted.len(), 2);
    }

    #[test]
    fn handles_missing_dependency() {
        let defs = vec![
            make_def("a", Some(vec!["missing"])),
        ];
        let sorted = topological_sort(&defs);
        assert_eq!(sorted.len(), 1);
        assert_eq!(sorted[0].id, "a");
    }
}
