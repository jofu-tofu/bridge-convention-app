//! Static data extractor — outputs convention JSON for build-time HTML generation.
//!
//! Thin binary that calls bridge-session viewport builders. MUST NOT contain
//! convention logic or data — it is purely a caller.
//!
//! Usage: bridge-static [--output <path>]
//!   Writes JSON to <path> (default: stdout).

use std::collections::HashMap;
use std::io::Write;

use bridge_conventions::BaseSystemId;
use bridge_session::session::{
    build_module_catalog, build_module_flow_tree, build_module_learning_viewport,
    ModuleCatalogEntry, ModuleFlowTreeViewport, ModuleLearningViewport,
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticLearnData {
    modules: Vec<ModuleCatalogEntry>,
    viewports: HashMap<String, ModuleViewportPair>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleViewportPair {
    learning: ModuleLearningViewport,
    flow_tree: Option<ModuleFlowTreeViewport>,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let output_path = args
        .windows(2)
        .find(|w| w[0] == "--output")
        .map(|w| w[1].as_str());

    let system = BaseSystemId::Sayc;
    let modules = build_module_catalog(system);

    let mut viewports = HashMap::new();
    let mut failures = Vec::new();

    for entry in &modules {
        let id = &entry.module_id;
        let learning = build_module_learning_viewport(id, system);
        let flow_tree = build_module_flow_tree(id, system);

        match learning {
            Some(l) => {
                viewports.insert(
                    id.clone(),
                    ModuleViewportPair {
                        learning: l,
                        flow_tree,
                    },
                );
            }
            None => {
                failures.push(id.clone());
            }
        }
    }

    if !failures.is_empty() {
        eprintln!(
            "ERROR: Failed to build learning viewport for modules: {}",
            failures.join(", ")
        );
        std::process::exit(1);
    }

    let module_count = modules.len();
    let data = StaticLearnData { modules, viewports };
    let json = serde_json::to_string_pretty(&data).expect("JSON serialization failed");

    match output_path {
        Some(path) => {
            let mut file = std::fs::File::create(path)
                .unwrap_or_else(|e| panic!("Failed to create {path}: {e}"));
            file.write_all(json.as_bytes())
                .unwrap_or_else(|e| panic!("Failed to write {path}: {e}"));
            eprintln!("Wrote {module_count} modules to {path}");
        }
        None => {
            println!("{json}");
        }
    }
}
