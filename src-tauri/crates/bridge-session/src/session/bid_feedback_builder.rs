//! Bid feedback builder — grades user bids and assembles feedback DTOs.
//!
//! 4-grade system: Correct (exact match), Acceptable (truth set or acceptable
//! set alternative), NearMiss (pipeline-derived, ≤1 failed condition in same
//! surface group), Incorrect.

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use crate::heuristics::BidResult;

// ── BidGrade ───────────────────────────────────────────────────────

/// Grade for a user's bid against the expected bid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BidGrade {
    /// Exact match with expected bid.
    #[serde(rename = "correct")]
    Correct,
    /// Acceptable alternative — in the truth set but not the primary choice.
    #[serde(rename = "acceptable")]
    Acceptable,
    /// Close but not quite right — on a considered surface with at most one failed condition.
    #[serde(rename = "near-miss")]
    NearMiss,
    /// Wrong bid.
    #[serde(rename = "incorrect")]
    Incorrect,
}

// ── BidFeedbackDTO ─────────────────────────────────────────────────

/// Assembled bid feedback — produced by grading a user's bid against strategy output.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidFeedbackDTO {
    pub grade: BidGrade,
    pub user_call: Call,
    pub expected_call: Option<Call>,
    pub explanation: String,
}

// ── Public API ─────────────────────────────────────────────────────

/// Grade a user's bid and assemble feedback.
///
/// Phase 4 simplified version: if expected result exists, checks for exact
/// call match. Full grading with teaching resolution, surface groups, and
/// practical scoring is deferred to convention pipeline integration.
pub fn assemble_bid_feedback(
    user_call: &Call,
    expected: Option<&BidResult>,
) -> BidFeedbackDTO {
    match expected {
        None => {
            // No convention strategy — any bid is accepted
            BidFeedbackDTO {
                grade: BidGrade::Correct,
                user_call: user_call.clone(),
                expected_call: None,
                explanation: "No convention strategy active".to_string(),
            }
        }
        Some(result) => {
            let grade = if call_equals(user_call, &result.call) {
                BidGrade::Correct
            } else if result.truth_set_calls.iter().any(|c| call_equals(user_call, c)) {
                BidGrade::Acceptable
            } else if result.near_miss_calls.iter().any(|c| call_equals(user_call, c)) {
                BidGrade::NearMiss
            } else {
                BidGrade::Incorrect
            };

            let explanation = if grade == BidGrade::Correct {
                result.explanation.clone()
            } else {
                format!("Expected different bid. {}", result.explanation)
            };

            BidFeedbackDTO {
                grade,
                user_call: user_call.clone(),
                expected_call: Some(result.call.clone()),
                explanation,
            }
        }
    }
}

/// Compare two Call values for equality.
pub fn call_equals(a: &Call, b: &Call) -> bool {
    match (a, b) {
        (
            Call::Bid { level: al, strain: as_ },
            Call::Bid { level: bl, strain: bs },
        ) => al == bl && as_ == bs,
        (Call::Pass, Call::Pass) => true,
        (Call::Double, Call::Double) => true,
        (Call::Redouble, Call::Redouble) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::BidSuit;

    #[test]
    fn correct_grade_when_matching() {
        let user_call = Call::Bid { level: 1, strain: BidSuit::NoTrump };
        let expected = BidResult {
            call: Call::Bid { level: 1, strain: BidSuit::NoTrump },
            rule_name: Some("stayman-response".to_string()),
            explanation: "Respond 1NT".to_string(),
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(feedback.grade, BidGrade::Correct);
        assert_eq!(feedback.explanation, "Respond 1NT");
    }

    #[test]
    fn incorrect_grade_when_different() {
        let user_call = Call::Bid { level: 2, strain: BidSuit::Clubs };
        let expected = BidResult {
            call: Call::Bid { level: 1, strain: BidSuit::NoTrump },
            rule_name: None,
            explanation: "Respond 1NT".to_string(),
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(feedback.grade, BidGrade::Incorrect);
        assert!(feedback.expected_call.is_some());
    }

    #[test]
    fn no_strategy_is_correct() {
        let user_call = Call::Pass;
        let feedback = assemble_bid_feedback(&user_call, None);
        assert_eq!(feedback.grade, BidGrade::Correct);
        assert!(feedback.expected_call.is_none());
    }

    #[test]
    fn call_equals_pass() {
        assert!(call_equals(&Call::Pass, &Call::Pass));
    }

    #[test]
    fn call_equals_bid() {
        let a = Call::Bid { level: 1, strain: BidSuit::Hearts };
        let b = Call::Bid { level: 1, strain: BidSuit::Hearts };
        assert!(call_equals(&a, &b));
    }

    #[test]
    fn call_not_equals_different_type() {
        assert!(!call_equals(&Call::Pass, &Call::Double));
    }

    #[test]
    fn call_not_equals_different_bid() {
        let a = Call::Bid { level: 1, strain: BidSuit::Hearts };
        let b = Call::Bid { level: 2, strain: BidSuit::Hearts };
        assert!(!call_equals(&a, &b));
    }

    #[test]
    fn call_equals_double() {
        assert!(call_equals(&Call::Double, &Call::Double));
    }

    #[test]
    fn call_equals_redouble() {
        assert!(call_equals(&Call::Redouble, &Call::Redouble));
    }

    #[test]
    fn bid_grade_serialization() {
        assert_eq!(
            serde_json::to_string(&BidGrade::Correct).unwrap(),
            r#""correct""#
        );
        assert_eq!(
            serde_json::to_string(&BidGrade::Incorrect).unwrap(),
            r#""incorrect""#
        );
        assert_eq!(
            serde_json::to_string(&BidGrade::NearMiss).unwrap(),
            r#""near-miss""#
        );
    }

    // ── 4-grade grading contract ──────────────────────────────────────
    //
    // Correct (exact match), Acceptable (truth set / acceptable set),
    // NearMiss (pipeline-derived, ≤1 failed condition), Incorrect.

    #[test]
    fn acceptable_for_truth_set_alternative() {
        // User bids 2H (transfer to spades) when preferred is 2C (Stayman).
        // Both are valid for this hand — user's choice is in truth set but
        // not the preferred (selected) call.
        let user_call = Call::Bid { level: 2, strain: BidSuit::Hearts };
        let expected = BidResult {
            call: Call::Bid { level: 2, strain: BidSuit::Clubs },
            rule_name: Some("stayman:ask-major".to_string()),
            explanation: "Stayman is preferred with 4-card major".to_string(),
            truth_set_calls: vec![Call::Bid { level: 2, strain: BidSuit::Hearts }],
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(
            feedback.grade, BidGrade::Acceptable,
            "Truth-set alternative should be Acceptable, got {:?}",
            feedback.grade,
        );
    }

    #[test]
    fn near_miss_when_in_near_miss_calls() {
        // User bids 2D when expected is 3D — 2D is in near_miss_calls (pipeline-derived).
        let user_call = Call::Bid { level: 2, strain: BidSuit::Diamonds };
        let expected = BidResult {
            call: Call::Bid { level: 3, strain: BidSuit::Diamonds },
            rule_name: Some("bergen:limit-raise".to_string()),
            explanation: "Limit raise".to_string(),
            near_miss_calls: vec![Call::Bid { level: 2, strain: BidSuit::Diamonds }],
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(
            feedback.grade, BidGrade::NearMiss,
            "Bid in near_miss_calls should be NearMiss, got {:?}",
            feedback.grade,
        );
    }

    #[test]
    fn structural_near_miss_without_near_miss_calls_is_incorrect() {
        // User bids 2D when expected is 3D — same suit, wrong level,
        // but NOT in near_miss_calls. Should be Incorrect (no structural fallback).
        let user_call = Call::Bid { level: 2, strain: BidSuit::Diamonds };
        let expected = BidResult {
            call: Call::Bid { level: 3, strain: BidSuit::Diamonds },
            rule_name: Some("bergen:limit-raise".to_string()),
            explanation: "Limit raise".to_string(),
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(
            feedback.grade, BidGrade::Incorrect,
            "Structural near-miss without near_miss_calls should be Incorrect, got {:?}",
            feedback.grade,
        );
    }

    #[test]
    fn correct_with_expanded_grading_context() {
        // Exact match stays Correct — regression guard.
        let user_call = Call::Bid { level: 2, strain: BidSuit::Clubs };
        let expected = BidResult {
            call: Call::Bid { level: 2, strain: BidSuit::Clubs },
            rule_name: Some("stayman:ask-major".to_string()),
            explanation: "Stayman".to_string(),
            truth_set_calls: vec![Call::Bid { level: 2, strain: BidSuit::Hearts }],
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(
            feedback.grade, BidGrade::Correct,
            "Exact match should remain Correct, got {:?}",
            feedback.grade,
        );
    }

    #[test]
    fn incorrect_for_unrelated_bid() {
        // 4C when expected is 3D — completely unrelated bid.
        let user_call = Call::Bid { level: 4, strain: BidSuit::Clubs };
        let expected = BidResult {
            call: Call::Bid { level: 3, strain: BidSuit::Diamonds },
            rule_name: Some("bergen:limit-raise".to_string()),
            explanation: "Limit raise".to_string(),
            ..Default::default()
        };
        let feedback = assemble_bid_feedback(&user_call, Some(&expected));
        assert_eq!(
            feedback.grade, BidGrade::Incorrect,
            "Unrelated bid should remain Incorrect, got {:?}",
            feedback.grade,
        );
    }
}
