//! Derive `PublicConstraint`s from the observation log.
//!
//! Walks the committed-step log and synthesizes commitments that disclose
//! partner's state from convention-response carriers. Currently covers
//! Blackwood ace/king responses; additional conventions (e.g. Gerber,
//! control bids) can add their own mapping here.
//!
//! Keeping this logic in `bridge-conventions` — alongside the meaning
//! evaluator and commit-log utilities — ensures both the service-layer
//! adapter and the per-surface meaning-evaluator projection path see
//! the same commitments (closing the coverage gap noted historically in
//! `meaning_evaluator.rs`).

use crate::fact_dsl::types::{PublicConstraint, PublicFactConstraint};
use crate::pipeline::observation::committed_step::CommittedStep;
use crate::types::{ConstraintValue, FactOperator};

/// Walk the observation log and synthesize `PublicConstraint`s exposing
/// partner's disclosed ace/king count from Blackwood response carriers.
///
/// The asker is identified as the seat that committed `blackwood:ask-aces`;
/// the asker's partner is the one whose `blackwood:response-*-aces` /
/// `blackwood:king-response-*` carriers reveal the counts. Only carriers
/// actually committed by the asker's partner produce constraints.
///
/// Unexpected Blackwood-phase carriers (anything in the `blackwood:` namespace
/// that isn't in the 10 expected response strings) are logged at `warn`.
pub fn derive_blackwood_commitments(log: &[CommittedStep]) -> Vec<PublicConstraint> {
    // Find the asker seat — whoever committed blackwood:ask-aces.
    let asker_seat = log.iter().find_map(|step| {
        step.resolved_claim.as_ref().and_then(|c| {
            if c.meaning_id == "blackwood:ask-aces" {
                Some(step.actor)
            } else {
                None
            }
        })
    });
    let Some(asker) = asker_seat else {
        return Vec::new();
    };
    let asker_partner = bridge_engine::constants::partner_seat(asker);

    let mut out: Vec<PublicConstraint> = Vec::new();

    for step in log {
        let claim = match step.resolved_claim.as_ref() {
            Some(c) => c,
            None => continue,
        };
        let meaning_id = claim.meaning_id.as_str();

        let mapped: Option<(&str, u8)> = match meaning_id {
            "blackwood:response-0-aces" => Some(("module.partner.aceCount", 0)),
            "blackwood:response-1-ace" => Some(("module.partner.aceCount", 1)),
            "blackwood:response-2-aces" => Some(("module.partner.aceCount", 2)),
            "blackwood:response-3-aces" => Some(("module.partner.aceCount", 3)),
            "blackwood:response-4-aces" => Some(("module.partner.aceCount", 4)),
            "blackwood:king-response-0" => Some(("module.partner.kingCount", 0)),
            "blackwood:king-response-1" => Some(("module.partner.kingCount", 1)),
            "blackwood:king-response-2" => Some(("module.partner.kingCount", 2)),
            "blackwood:king-response-3" => Some(("module.partner.kingCount", 3)),
            "blackwood:king-response-4" => Some(("module.partner.kingCount", 4)),
            other
                if other.starts_with("blackwood:response-")
                    || other.starts_with("blackwood:king-response") =>
            {
                tracing::warn!(
                    meaning_id = other,
                    "unexpected Blackwood response carrier in observation log"
                );
                None
            }
            _ => None,
        };

        let Some((fact_id, count)) = mapped else {
            continue;
        };

        if step.actor != asker_partner {
            continue;
        }

        out.push(PublicConstraint {
            subject: "partner".to_string(),
            constraint: PublicFactConstraint {
                fact_id: fact_id.to_string(),
                operator: FactOperator::Eq,
                value: ConstraintValue::Number(serde_json::Number::from(count)),
            },
        });
    }

    out
}

/// Derive the full set of `PublicConstraint`s from the observation log.
///
/// Currently only Blackwood ace/king responses contribute. Future
/// convention-derived public commitments should plug in here.
pub fn derive_public_commitments(log: &[CommittedStep]) -> Vec<PublicConstraint> {
    derive_blackwood_commitments(log)
}
