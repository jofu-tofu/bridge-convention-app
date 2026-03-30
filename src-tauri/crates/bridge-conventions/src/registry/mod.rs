//! Convention registry — runtime lookup for modules, bundles, and specs.
//!
//! Pre-baked JSON is embedded via `include_str!()` and deserialized on first access.
//! Module factories only vary by SystemConfig (SAYC/2/1/Acol), so pre-baked JSON
//! per system variant is sufficient.

pub mod system_configs;
pub mod module_registry;
pub mod bundle_registry;
pub mod spec_builder;

pub use system_configs::*;
pub use module_registry::{get_module, get_all_modules};
pub use bundle_registry::{get_bundle_input, list_bundle_inputs, resolve_bundle};
pub use spec_builder::spec_from_bundle;
