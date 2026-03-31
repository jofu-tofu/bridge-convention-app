//! Bid feedback builder — grades user bids and assembles feedback DTOs.
//!
//! Ported from TS `src/session/bid-feedback-builder.ts`. Simplified for Phase 4:
//! convention strategy integration is deferred, so grading is basic (exact match
//! or incorrect). Full grading with teaching resolution will come when the
//! convention pipeline is integrated.

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
    /// Correct but not the preferred choice.
    #[serde(rename = "correct-not-preferred")]
    CorrectNotPreferred,
    /// Acceptable alternative (convention allows it).
    #[serde(rename = "acceptable")]
    Acceptable,
    /// Close but not quite right.
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
            if call_equals(user_call, &result.call) {
                BidFeedbackDTO {
                    grade: BidGrade::Correct,
                    user_call: user_call.clone(),
                    expected_call: Some(result.call.clone()),
                    explanation: result.explanation.clone(),
                }
            } else {
                BidFeedbackDTO {
                    grade: BidGrade::Incorrect,
                    user_call: user_call.clone(),
                    expected_call: Some(result.call.clone()),
                    explanation: format!(
                        "Expected different bid. {}",
                        result.explanation,
                    ),
                }
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
}
