//! Teaching resolution — bid grading and acceptable bid resolution.
//!
//! Mirrors TS from `conventions/teaching/teaching-resolution.ts`.

use bridge_engine::types::Call;

use crate::adapter::tree_evaluation::ResolvedCandidateDTO;
use crate::teaching::teaching_types::*;

/// Check if a candidate is eligible for teaching.
fn is_teaching_eligible(c: &ResolvedCandidateDTO) -> bool {
    match &c.eligibility {
        Some(e) => e.hand.satisfied && e.encoding.legal && e.pedagogical.acceptable,
        None => c.legal && c.failed_conditions.is_empty(),
    }
}

/// Look up the SurfaceGroup containing a given bidName.
fn find_group_for_bid<'a>(
    bid_name: &str,
    families: &'a [SurfaceGroup],
) -> Option<&'a SurfaceGroup> {
    families.iter().find(|f| f.members.iter().any(|m| m == bid_name))
}

/// Resolve teaching answer from a primary bid and candidates.
pub fn resolve_teaching_answer(
    primary_bid: Call,
    candidates: &[ResolvedCandidateDTO],
    surface_groups: Option<&[SurfaceGroup]>,
) -> TeachingResolution {
    if candidates.is_empty() {
        return TeachingResolution {
            primary_bid,
            acceptable_bids: Vec::new(),
            grading_type: GradingType::Exact,
            ambiguity_score: 0.0,
            truth_set_calls: None,
            near_miss_calls: None,
        };
    }

    // Truth-set calls: candidates that satisfy hand constraints and are legal,
    // but encode a different call than the primary.
    let truth_set_calls: Vec<Call> = candidates
        .iter()
        .filter(|c| c.is_matched && c.legal && !calls_match(&c.resolved_call, &primary_bid))
        .map(|c| c.resolved_call.clone())
        .collect();

    // Priority-based acceptable bids
    let mut acceptable_bids: Vec<AcceptableBid> = candidates
        .iter()
        .filter(|c| {
            !c.is_matched
                && is_teaching_eligible(c)
                && c.priority.is_some()
        })
        .map(|c| {
            let tier = match c.priority {
                Some(crate::adapter::tree_evaluation::CandidatePriority::Preferred) => AcceptableTier::Preferred,
                _ => AcceptableTier::Alternative,
            };
            AcceptableBid {
                call: c.resolved_call.clone(),
                bid_name: c.bid_name.clone(),
                meaning: c.meaning.clone(),
                reason: format!("{:?} alternative: {}", tier, c.meaning),
                full_credit: tier == AcceptableTier::Preferred,
                tier,
                relationship: None,
                module_id: c.module_id.clone(),
            }
        })
        .collect();

    // Deduplicate
    let mut seen = std::collections::HashSet::new();
    acceptable_bids.retain(|b| seen.insert(b.bid_name.clone()));

    // Near-miss detection
    let near_miss_calls = if let Some(groups) = surface_groups {
        if !groups.is_empty() {
            let matched = candidates.iter().find(|c| c.is_matched);
            if let Some(matched_c) = matched {
                if let Some(family) = find_group_for_bid(&matched_c.bid_name, groups) {
                    let near_misses: Vec<NearMissCall> = candidates
                        .iter()
                        .filter(|c| {
                            !c.is_matched
                                && !c.failed_conditions.is_empty()
                                && family.members.iter().any(|m| m == &c.bid_name)
                                && !seen.contains(&c.bid_name)
                        })
                        .map(|c| NearMissCall {
                            call: c.resolved_call.clone(),
                            reason: c
                                .failed_conditions
                                .iter()
                                .map(|fc| fc.description.as_str())
                                .collect::<Vec<_>>()
                                .join("; "),
                        })
                        .collect();

                    if !near_misses.is_empty() {
                        Some(near_misses)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let matched_candidate = candidates.iter().find(|c| c.is_matched);
    let preferred_count = acceptable_bids.iter().filter(|b| b.tier == AcceptableTier::Preferred).count();

    let grading_type = if matched_candidate.map(|c| !c.is_default_call).unwrap_or(false) {
        GradingType::IntentBased
    } else if !acceptable_bids.is_empty() {
        GradingType::PrimaryPlusAcceptable
    } else {
        GradingType::Exact
    };

    let ambiguity_score = if acceptable_bids.is_empty() {
        0.0
    } else if preferred_count >= 2 {
        0.8
    } else if preferred_count >= 1 {
        0.6
    } else {
        0.3
    };

    TeachingResolution {
        primary_bid,
        acceptable_bids,
        grading_type,
        ambiguity_score,
        truth_set_calls: if truth_set_calls.is_empty() {
            None
        } else {
            Some(truth_set_calls)
        },
        near_miss_calls,
    }
}

/// Grade a user's bid against the teaching resolution.
pub fn grade_bid(user_call: &Call, resolution: &TeachingResolution) -> BidGrade {
    if calls_match(user_call, &resolution.primary_bid) {
        return BidGrade::Correct;
    }
    if let Some(ref truth_calls) = resolution.truth_set_calls {
        if truth_calls.iter().any(|c| calls_match(user_call, c)) {
            return BidGrade::CorrectNotPreferred;
        }
    }
    if resolution.acceptable_bids.iter().any(|b| calls_match(user_call, &b.call)) {
        return BidGrade::Acceptable;
    }
    if let Some(ref near_misses) = resolution.near_miss_calls {
        if near_misses.iter().any(|nm| calls_match(user_call, &nm.call)) {
            return BidGrade::NearMiss;
        }
    }
    BidGrade::Incorrect
}

/// Compare two calls for equality.
fn calls_match(a: &Call, b: &Call) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grade_correct() {
        let resolution = TeachingResolution {
            primary_bid: Call::Pass,
            acceptable_bids: Vec::new(),
            grading_type: GradingType::Exact,
            ambiguity_score: 0.0,
            truth_set_calls: None,
            near_miss_calls: None,
        };
        assert_eq!(grade_bid(&Call::Pass, &resolution), BidGrade::Correct);
    }

    #[test]
    fn grade_incorrect() {
        let resolution = TeachingResolution {
            primary_bid: Call::Pass,
            acceptable_bids: Vec::new(),
            grading_type: GradingType::Exact,
            ambiguity_score: 0.0,
            truth_set_calls: None,
            near_miss_calls: None,
        };
        let bid = Call::Bid {
            level: 1,
            strain: bridge_engine::types::BidSuit::NoTrump,
        };
        assert_eq!(grade_bid(&bid, &resolution), BidGrade::Incorrect);
    }
}
