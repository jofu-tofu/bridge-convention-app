//! Practical scorer — scores candidates for practical recommendation.
//!
//! Mirrors TS from `conventions/adapter/practical-scorer.ts`.

use bridge_engine::types::Call;

use crate::adapter::strategy_evaluation::PracticalRecommendation;
use crate::pipeline::types::PipelineCarrier;

/// HCP threshold table by level — what HCP range is reasonable for each contract level.
const LEVEL_HCP_TABLE: [(u8, f64, f64); 7] = [
    (1, 6.0, 16.0),
    (2, 10.0, 22.0),
    (3, 13.0, 26.0),
    (4, 14.0, 30.0),
    (5, 15.0, 33.0),
    (6, 16.0, 36.0),
    (7, 17.0, 40.0),
];

/// Score a carrier practically.
///
/// Returns a score where higher = more practical.
fn score_candidate(carrier: &PipelineCarrier, hcp: f64) -> f64 {
    let mut score = 0.0;

    // Base score from ranking
    let band_score = match carrier.ranking().recommendation_band {
        crate::types::meaning::RecommendationBand::Must => 4.0,
        crate::types::meaning::RecommendationBand::Should => 3.0,
        crate::types::meaning::RecommendationBand::May => 2.0,
        crate::types::meaning::RecommendationBand::Avoid => 0.0,
    };
    score += band_score;

    // Specificity bonus
    score += carrier.ranking().specificity * 0.5;

    // HCP reasonableness for the contract level
    if let Call::Bid { level, .. } = carrier.call() {
        let (_, min_hcp, max_hcp) = LEVEL_HCP_TABLE
            .iter()
            .find(|(l, _, _)| *l == *level)
            .copied()
            .unwrap_or((1, 6.0, 16.0));

        if hcp >= min_hcp && hcp <= max_hcp {
            score += 1.0;
        } else if hcp < min_hcp {
            score -= (min_hcp - hcp) * 0.1;
        }
    }

    score
}

/// Build a practical recommendation from the top-scoring carrier.
pub fn build_practical_recommendation(
    carriers: &[PipelineCarrier],
    hcp: f64,
) -> Option<PracticalRecommendation> {
    if carriers.is_empty() {
        return None;
    }

    let mut best_score = f64::NEG_INFINITY;
    let mut best_carrier: Option<&PipelineCarrier> = None;

    for carrier in carriers {
        let score = score_candidate(carrier, hcp);
        if score > best_score {
            best_score = score;
            best_carrier = Some(carrier);
        }
    }

    best_carrier.map(|c| PracticalRecommendation {
        call: c.call().clone(),
        reason: format!(
            "Practical choice: {} (score: {:.1})",
            c.proposal().teaching_label.name,
            best_score
        ),
        confidence: (best_score / 5.0).clamp(0.0, 1.0),
    })
}
