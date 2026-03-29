//! Meaning strategy — simplified surfaces → pipeline → result path.
//!
//! Mirrors TS from `conventions/adapter/meaning-strategy.ts`.

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
    inherited_dimensions: &[ConstraintDimension],
) -> PipelineResult {
    run_pipeline(PipelineInput {
        surfaces,
        facts,
        inherited_dimensions,
        is_legal,
    })
}
