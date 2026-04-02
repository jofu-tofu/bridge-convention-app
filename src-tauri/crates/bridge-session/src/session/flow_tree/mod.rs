//! Flow tree builder — builds conversation flow trees for bundles and modules.
//!
//! Rust port of TS `src/session/flow-tree-builder.ts`. Reads convention module
//! FSM topology and produces FlowTreeNode hierarchies for UI consumption.
//!
//! Submodules:
//! - `types` — exported viewport types + internal mutable tree representation
//! - `tree_helpers` — node construction, traversal, and matching utilities
//! - `surface_collector` — module data collection from FSM topology
//! - `tree_assembler` — recursive subtree building and route attachment
//! - `bundle_builder` — unified bundle flow tree construction
//! - `module_builder` — single-module flow tree construction

mod types;
mod tree_helpers;
mod surface_collector;
mod tree_assembler;
mod bundle_builder;
mod module_builder;

pub use types::{BundleFlowTreeViewport, FlowTreeNode, ModuleFlowTreeViewport};
pub use bundle_builder::build_bundle_flow_tree;
pub use module_builder::build_module_flow_tree;

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::types::bid_action::{BidActionType, HandFeature};
    use bridge_conventions::types::rule_types::{ObsPattern, ObsPatternAct};
    use bridge_conventions::types::system_config::BaseSystemId;
    use tree_helpers::{max_depth_of, mk_node, obs_matches_step};
    use types::NodeCounter;

    #[test]
    fn max_depth_of_leaf() {
        let mut counter = NodeCounter { value: 0 };
        let node = mk_node(None, "root", None, 0, &mut counter, Some("Root"), None);
        assert_eq!(max_depth_of(&node), 0);
    }

    #[test]
    fn max_depth_of_nested() {
        let mut counter = NodeCounter { value: 0 };
        let child2 = mk_node(None, "deep", None, 2, &mut counter, Some("Deep"), None);
        let mut child1 = mk_node(None, "mid", None, 1, &mut counter, Some("Mid"), None);
        child1.children.push(child2);
        let mut root = mk_node(None, "root", None, 0, &mut counter, Some("Root"), None);
        root.children.push(child1);
        assert_eq!(max_depth_of(&root), 2);
    }

    #[test]
    fn obs_matches_step_any_act() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_specific_match() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_mismatch() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_none_obs() {
        let step = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(None, &step));
    }

    #[test]
    fn obs_matches_step_feature_mismatch() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn build_module_flow_tree_stayman() {
        let result = build_module_flow_tree("stayman", BaseSystemId::Sayc);
        assert!(
            result.is_some(),
            "build_module_flow_tree('stayman') should return Some"
        );
        let viewport = result.unwrap();
        assert_eq!(viewport.module_id, "stayman");
        assert!(!viewport.module_name.is_empty());
        assert!(viewport.node_count > 0);
    }

    #[test]
    fn build_bundle_flow_tree_nt_bundle() {
        let result = build_bundle_flow_tree("nt-bundle", BaseSystemId::Sayc);
        assert!(
            result.is_some(),
            "build_bundle_flow_tree('nt-bundle') should return Some"
        );
        let viewport = result.unwrap();
        assert_eq!(viewport.bundle_id, "nt-bundle");
        assert!(viewport.node_count > 0);
        assert!(viewport.max_depth > 0);
    }
}
