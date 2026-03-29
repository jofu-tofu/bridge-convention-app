//! Kernel extractor — computes NegotiationState and deltas.
//!
//! In the Rust port, NegotiationState is directly computed from CommittedStep
//! state tracking rather than extracted from MachineRegisters (which is a TS-only
//! legacy type). The computeKernelDelta function is preserved.

use crate::types::negotiation::*;

/// Compute the delta between two kernel states. Returns only changed fields.
pub fn compute_kernel_delta(before: &NegotiationState, after: &NegotiationState) -> NegotiationDelta {
    let mut delta = NegotiationDelta::default();

    if after.forcing != before.forcing {
        delta.forcing = Some(after.forcing);
    }

    if after.captain != before.captain {
        delta.captain = Some(after.captain);
    }

    if !fit_agreed_equal(&before.fit_agreed, &after.fit_agreed) {
        delta.fit_agreed = Some(after.fit_agreed.clone());
    }

    if !competition_equal(&before.competition, &after.competition) {
        delta.competition = Some(after.competition.clone());
    }

    delta
}

fn fit_agreed_equal(a: &Option<FitAgreed>, b: &Option<FitAgreed>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(fa), Some(fb)) => fa.strain == fb.strain && fa.confidence == fb.confidence,
        _ => false,
    }
}

fn competition_equal(a: &Competition, b: &Competition) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::types::bid_action::BidSuitName;

    fn initial() -> NegotiationState {
        crate::pipeline::observation::committed_step::initial_negotiation()
    }

    #[test]
    fn delta_no_changes() {
        let state = initial();
        let delta = compute_kernel_delta(&state, &state);
        assert_eq!(delta, NegotiationDelta::default());
    }

    #[test]
    fn delta_forcing_changed() {
        let before = initial();
        let after = NegotiationState {
            forcing: ForcingLevel::Game,
            ..before.clone()
        };
        let delta = compute_kernel_delta(&before, &after);
        assert_eq!(delta.forcing, Some(ForcingLevel::Game));
        assert_eq!(delta.captain, None);
    }

    #[test]
    fn delta_fit_agreed_changed() {
        let before = initial();
        let after = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Tentative,
            }),
            ..before.clone()
        };
        let delta = compute_kernel_delta(&before, &after);
        assert!(delta.fit_agreed.is_some());
    }
}
