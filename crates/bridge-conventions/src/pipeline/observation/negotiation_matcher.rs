//! Kernel matcher — evaluates NegotiationExpr predicates against NegotiationState.
//!
//! Mirrors TS from `pipeline/observation/negotiation-matcher.ts`.

use crate::types::bid_action::BidSuitName;
use crate::types::negotiation::{Competition, CompetitionSimple, NegotiationState};
use crate::types::rule_types::NegotiationExpr;

/// Evaluate a NegotiationExpr against the current NegotiationState.
pub fn match_kernel(expr: &NegotiationExpr, kernel: &NegotiationState) -> bool {
    match expr {
        NegotiationExpr::Fit { strain } => match &kernel.fit_agreed {
            None => false,
            Some(fit) => match strain {
                Some(s) => fit.strain == *s,
                None => true,
            },
        },

        NegotiationExpr::NoFit => kernel.fit_agreed.is_none(),

        NegotiationExpr::Forcing { level } => {
            // Map NegotiationForcingLevel to ForcingLevel for comparison
            use crate::types::negotiation::ForcingLevel;
            use crate::types::rule_types::NegotiationForcingLevel;
            let kernel_level = match kernel.forcing {
                ForcingLevel::None => NegotiationForcingLevel::None,
                ForcingLevel::OneRound => NegotiationForcingLevel::OneRound,
                ForcingLevel::Game => NegotiationForcingLevel::Game,
            };
            kernel_level == *level
        }

        NegotiationExpr::Captain { who } => {
            use crate::types::negotiation::Captain;
            use crate::types::rule_types::NegotiationCaptain;
            let kernel_captain = match kernel.captain {
                Captain::Opener => NegotiationCaptain::Opener,
                Captain::Responder => NegotiationCaptain::Responder,
                Captain::Undecided => NegotiationCaptain::Undecided,
            };
            kernel_captain == *who
        }

        NegotiationExpr::Uncontested => {
            kernel.competition == Competition::Simple(CompetitionSimple::Uncontested)
        }

        NegotiationExpr::Doubled => {
            kernel.competition == Competition::Simple(CompetitionSimple::Doubled)
        }

        NegotiationExpr::Redoubled => {
            kernel.competition == Competition::Simple(CompetitionSimple::Redoubled)
        }

        NegotiationExpr::Overcalled { below } => match &kernel.competition {
            Competition::Simple(_) => false,
            Competition::Overcalled(data) => match below {
                None => true,
                Some(threshold) => {
                    is_bid_below(data.level, data.strain, threshold.level, threshold.strain)
                }
            },
        },

        NegotiationExpr::And { exprs } => exprs.iter().all(|e| match_kernel(e, kernel)),

        NegotiationExpr::Or { exprs } => exprs.iter().any(|e| match_kernel(e, kernel)),

        NegotiationExpr::Not { expr } => !match_kernel(expr, kernel),
    }
}

/// Strain ordering for bid comparison.
fn strain_order(strain: BidSuitName) -> u8 {
    match strain {
        BidSuitName::Clubs => 0,
        BidSuitName::Diamonds => 1,
        BidSuitName::Hearts => 2,
        BidSuitName::Spades => 3,
        BidSuitName::Notrump => 4,
    }
}

/// Is the bid (level, strain) strictly below the threshold?
fn is_bid_below(level: u8, strain: BidSuitName, th_level: u8, th_strain: BidSuitName) -> bool {
    if level < th_level {
        return true;
    }
    if level > th_level {
        return false;
    }
    strain_order(strain) < strain_order(th_strain)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::negotiation::*;
    use crate::types::rule_types::*;

    fn initial_kernel() -> NegotiationState {
        NegotiationState {
            fit_agreed: None,
            forcing: ForcingLevel::None,
            captain: Captain::Undecided,
            competition: Competition::Simple(CompetitionSimple::Uncontested),
        }
    }

    #[test]
    fn match_uncontested() {
        assert!(match_kernel(
            &NegotiationExpr::Uncontested,
            &initial_kernel()
        ));
    }

    #[test]
    fn match_no_fit() {
        assert!(match_kernel(&NegotiationExpr::NoFit, &initial_kernel()));
    }

    #[test]
    fn match_fit_any() {
        let kernel = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Tentative,
            }),
            ..initial_kernel()
        };
        assert!(match_kernel(
            &NegotiationExpr::Fit { strain: None },
            &kernel
        ));
    }

    #[test]
    fn match_fit_specific_strain() {
        let kernel = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Hearts,
                confidence: ConfidenceLevel::Final,
            }),
            ..initial_kernel()
        };
        assert!(match_kernel(
            &NegotiationExpr::Fit {
                strain: Some(BidSuitName::Hearts)
            },
            &kernel,
        ));
        assert!(!match_kernel(
            &NegotiationExpr::Fit {
                strain: Some(BidSuitName::Spades)
            },
            &kernel,
        ));
    }

    #[test]
    fn match_and_or_not() {
        let kernel = initial_kernel();
        let expr = NegotiationExpr::And {
            exprs: vec![
                NegotiationExpr::Uncontested,
                NegotiationExpr::Not {
                    expr: Box::new(NegotiationExpr::Fit { strain: None }),
                },
            ],
        };
        assert!(match_kernel(&expr, &kernel));
    }
}
