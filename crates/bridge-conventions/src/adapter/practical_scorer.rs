//! Practical scorer — scores candidates for practical recommendation.
//!
//! Mirrors TS from `conventions/adapter/practical-scorer.ts`.

use std::collections::HashMap;

use bridge_engine::types::{Call, Suit};

use crate::adapter::strategy_evaluation::PracticalRecommendation;
use crate::pipeline::types::PipelineCarrier;

/// Partner context for partnership-aware practical scoring.
pub struct PartnerContext {
    /// Minimum HCP partner has shown.
    pub min_hcp: f64,
    /// Known suit length ranges (min, max) per suit.
    pub suit_lengths: HashMap<Suit, (u8, u8)>,
}

/// Partnership HCP thresholds by contract level.
const PARTNERSHIP_LEVEL_TABLE: [(u8, f64); 7] = [
    (1, 20.0),
    (2, 23.0),
    (3, 26.0),
    (4, 26.0),
    (5, 29.0),
    (6, 33.0),
    (7, 37.0),
];

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
/// When `partner` is provided, partnership HCP and fit bonuses are included.
pub fn score_candidate_practically(
    carrier: &PipelineCarrier,
    hcp: f64,
    partner: Option<&PartnerContext>,
) -> f64 {
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
    if let Call::Bid { level, strain } = carrier.call() {
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

        // Partnership HCP scoring
        if let Some(partner) = partner {
            let partnership_hcp = hcp + partner.min_hcp;
            let threshold = PARTNERSHIP_LEVEL_TABLE
                .iter()
                .find(|(l, _)| *l == *level)
                .map(|(_, t)| *t)
                .unwrap_or(20.0);
            score += (partnership_hcp - threshold) * 1.5;

            // Fit scoring for suit bids
            let suit = match strain {
                bridge_engine::types::BidSuit::Clubs => Some(Suit::Clubs),
                bridge_engine::types::BidSuit::Diamonds => Some(Suit::Diamonds),
                bridge_engine::types::BidSuit::Hearts => Some(Suit::Hearts),
                bridge_engine::types::BidSuit::Spades => Some(Suit::Spades),
                bridge_engine::types::BidSuit::NoTrump => None,
            };
            if let Some(suit) = suit {
                if let Some(&(partner_min, _)) = partner.suit_lengths.get(&suit) {
                    // Extract own suit length from carrier clauses if available
                    // (e.g., observed_value on "hand.spades" clause), else default to 4.
                    let suit_fact_id = match suit {
                        Suit::Clubs => "hand.clubs",
                        Suit::Diamonds => "hand.diamonds",
                        Suit::Hearts => "hand.hearts",
                        Suit::Spades => "hand.spades",
                    };
                    let own_length = carrier
                        .proposal()
                        .clauses
                        .iter()
                        .find_map(|c| {
                            if c.fact_id == suit_fact_id {
                                c.observed_value.as_ref().and_then(|v| v.as_f64())
                            } else {
                                None
                            }
                        })
                        .unwrap_or(4.0);
                    let combined_fit = own_length + partner_min as f64;
                    score += combined_fit * 2.0;
                }
            }
        }
    }

    score
}

/// Build a practical recommendation from the top-scoring carrier.
pub fn build_practical_recommendation(
    carriers: &[PipelineCarrier],
    hcp: f64,
    partner: Option<&PartnerContext>,
) -> Option<PracticalRecommendation> {
    if carriers.is_empty() {
        return None;
    }

    let mut best_score = f64::NEG_INFINITY;
    let mut best_carrier: Option<&PipelineCarrier> = None;

    for carrier in carriers {
        let score = score_candidate_practically(carrier, hcp, partner);
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
