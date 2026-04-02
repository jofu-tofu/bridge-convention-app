//! Meaning strategy — simplified surfaces → pipeline → result path.
//!
//! Mirrors TS from `conventions/adapter/meaning-strategy.ts`.

use std::collections::HashMap;

use bridge_engine::types::Call;

use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use crate::pipeline::types::PipelineResult;
use crate::types::meaning::{BidMeaning, ConstraintDimension};

/// Run the pipeline directly with pre-collected surfaces.
///
/// Simpler path when the caller has already collected matching surfaces
/// (e.g., from a different observation strategy).
pub fn meaning_to_strategy(
    surfaces: &[BidMeaning],
    facts: &EvaluatedFacts,
    is_legal: &dyn Fn(&Call) -> bool,
    inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
) -> PipelineResult {
    run_pipeline(PipelineInput {
        surfaces,
        facts,
        inherited_dimensions,
        is_legal,
        hand: None,
        system_config: None,
    })
}
