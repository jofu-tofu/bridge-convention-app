//! Pass strategy — always returns Pass. Ultimate fallback.
//!
//! Mirrors TS `passStrategy` from `session/heuristics/pass-strategy.ts`.

use bridge_engine::Call;

use super::{BidResult, BiddingContext, BiddingStrategy};

/// Always-pass strategy. Used as the final fallback in a strategy chain
/// to guarantee a legal bid is always produced.
pub struct PassStrategy;

impl BiddingStrategy for PassStrategy {
    fn id(&self) -> &str {
        "pass"
    }

    fn name(&self) -> &str {
        "Always Pass"
    }

    fn suggest_bid(&self, _context: &BiddingContext) -> Option<BidResult> {
        Some(BidResult {
            call: Call::Pass,
            rule_name: None,
            explanation: String::new(),
            ..Default::default()
        })
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{Auction, DistributionPoints, Hand, HandEvaluation, Seat};

    fn dummy_context() -> BiddingContext {
        BiddingContext {
            hand: Hand { cards: vec![] },
            auction: Auction {
                entries: vec![],
                is_complete: false,
            },
            seat: Seat::South,
            evaluation: HandEvaluation {
                hcp: 10,
                distribution: DistributionPoints {
                    shortness: 0,
                    length: 0,
                    total: 0,
                },
                shape: [4, 3, 3, 3],

                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: None,
        }
    }

    #[test]
    fn always_returns_pass() {
        let strategy = PassStrategy;
        let ctx = dummy_context();
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(result.call, Call::Pass);
    }

    #[test]
    fn never_returns_none() {
        let strategy = PassStrategy;
        let ctx = dummy_context();
        assert!(strategy.suggest_bid(&ctx).is_some());
    }

    #[test]
    fn has_correct_id_and_name() {
        let strategy = PassStrategy;
        assert_eq!(strategy.id(), "pass");
        assert_eq!(strategy.name(), "Always Pass");
    }
}
