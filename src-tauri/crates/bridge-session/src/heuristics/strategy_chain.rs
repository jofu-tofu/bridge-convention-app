//! Strategy chain — tries strategies in order, first non-None wins.
//!
//! Mirrors TS `createStrategyChain()` from `session/heuristics/strategy-chain.ts`.

use bridge_engine::strategy::{AttemptOutcome, ChainTrace, StrategyAttempt};

use super::{BidResult, BiddingContext, BiddingStrategy};

/// A chain of bidding strategies evaluated in order. The first strategy
/// to return `Some(BidResult)` wins. An optional result_filter can reject
/// results (e.g., forcing-bid enforcement), causing the chain to continue.
pub struct StrategyChain {
    strategies: Vec<Box<dyn BiddingStrategy>>,
    result_filter: Option<Box<dyn Fn(&BidResult, &BiddingContext) -> bool + Send + Sync>>,
    chain_id: String,
    chain_name: String,
}

impl StrategyChain {
    /// Create a new strategy chain from an ordered list of strategies.
    pub fn new(strategies: Vec<Box<dyn BiddingStrategy>>) -> Self {
        let chain_id = format!(
            "chain:{}",
            strategies
                .iter()
                .map(|s| s.id())
                .collect::<Vec<_>>()
                .join("+")
        );
        let chain_name = format!(
            "Chain({})",
            strategies
                .iter()
                .map(|s| s.name())
                .collect::<Vec<_>>()
                .join(", ")
        );
        Self {
            strategies,
            result_filter: None,
            chain_id,
            chain_name,
        }
    }

    /// Set a result filter that can reject strategy results.
    /// The filter returns `true` to accept the result, `false` to reject it
    /// (causing the chain to continue to the next strategy).
    pub fn with_result_filter(
        mut self,
        filter: Box<dyn Fn(&BidResult, &BiddingContext) -> bool + Send + Sync>,
    ) -> Self {
        self.result_filter = Some(filter);
        self
    }

    /// Suggest a bid, returning both the result and a trace of which strategies
    /// were attempted.
    pub fn suggest_with_trace(&self, context: &BiddingContext) -> (Option<BidResult>, ChainTrace) {
        let mut trace = ChainTrace::default();

        for strategy in &self.strategies {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                strategy.suggest_bid(context)
            }));

            match result {
                Ok(Some(mut bid_result)) => {
                    // Apply result filter if set (e.g., forcing-bid enforcement)
                    let accepted = match &self.result_filter {
                        Some(filter) => filter(&bid_result, context),
                        None => true,
                    };
                    if accepted {
                        trace.attempts.push(StrategyAttempt {
                            strategy_id: strategy.id().to_string(),
                            outcome: AttemptOutcome::Suggested,
                        });
                        bid_result.trace = Some(trace.clone());
                        return (Some(bid_result), trace);
                    }
                    // Filter rejected — record as declined and continue
                    trace.attempts.push(StrategyAttempt {
                        strategy_id: strategy.id().to_string(),
                        outcome: AttemptOutcome::Declined,
                    });
                }
                Ok(None) => {
                    trace.attempts.push(StrategyAttempt {
                        strategy_id: strategy.id().to_string(),
                        outcome: AttemptOutcome::Declined,
                    });
                }
                Err(_) => {
                    trace.attempts.push(StrategyAttempt {
                        strategy_id: strategy.id().to_string(),
                        outcome: AttemptOutcome::Error,
                    });
                }
            }
        }

        (None, trace)
    }
}

impl BiddingStrategy for StrategyChain {
    fn id(&self) -> &str {
        &self.chain_id
    }

    fn name(&self) -> &str {
        &self.chain_name
    }

    fn suggest_bid(&self, context: &BiddingContext) -> Option<BidResult> {
        self.suggest_with_trace(context).0
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{Auction, BidSuit, Call, DistributionPoints, Hand, HandEvaluation, Seat};

    /// A strategy that always declines.
    struct AlwaysDecline;

    impl BiddingStrategy for AlwaysDecline {
        fn id(&self) -> &str {
            "always-decline"
        }
        fn name(&self) -> &str {
            "Always Decline"
        }
        fn suggest_bid(&self, _context: &BiddingContext) -> Option<BidResult> {
            None
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    /// A strategy that always suggests 1C.
    struct AlwaysBidOneClub;

    impl BiddingStrategy for AlwaysBidOneClub {
        fn id(&self) -> &str {
            "always-1C"
        }
        fn name(&self) -> &str {
            "Always 1C"
        }
        fn suggest_bid(&self, _context: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Bid {
                    level: 1,
                    strain: BidSuit::Clubs,
                },
                rule_name: None,
                explanation: "Always bids 1C".to_string(),
                ..Default::default()
            })
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    /// A strategy that always suggests 1H.
    struct AlwaysBidOneHeart;

    impl BiddingStrategy for AlwaysBidOneHeart {
        fn id(&self) -> &str {
            "always-1H"
        }
        fn name(&self) -> &str {
            "Always 1H"
        }
        fn suggest_bid(&self, _context: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Bid {
                    level: 1,
                    strain: BidSuit::Hearts,
                },
                rule_name: None,
                explanation: "Always bids 1H".to_string(),
                ..Default::default()
            })
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

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
    fn chain_returns_first_non_none() {
        let chain = StrategyChain::new(vec![
            Box::new(AlwaysDecline),
            Box::new(AlwaysBidOneClub),
            Box::new(AlwaysBidOneHeart),
        ]);
        let ctx = dummy_context();
        let result = chain.suggest_bid(&ctx);
        assert!(result.is_some());
        assert_eq!(
            result.unwrap().call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            }
        );
    }

    #[test]
    fn chain_returns_none_when_all_decline() {
        let chain = StrategyChain::new(vec![Box::new(AlwaysDecline), Box::new(AlwaysDecline)]);
        let ctx = dummy_context();
        assert!(chain.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn chain_priority_first_wins() {
        let chain = StrategyChain::new(vec![
            Box::new(AlwaysBidOneHeart),
            Box::new(AlwaysBidOneClub),
        ]);
        let ctx = dummy_context();
        let result = chain.suggest_bid(&ctx).unwrap();
        assert_eq!(
            result.call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Hearts
            }
        );
    }

    #[test]
    fn trace_records_attempts() {
        let chain = StrategyChain::new(vec![
            Box::new(AlwaysDecline),
            Box::new(AlwaysBidOneClub),
            Box::new(AlwaysBidOneHeart),
        ]);
        let ctx = dummy_context();
        let (result, trace) = chain.suggest_with_trace(&ctx);

        assert!(result.is_some());
        // Only 2 attempts: decline + suggested (third never reached)
        assert_eq!(trace.attempts.len(), 2);
        assert_eq!(trace.attempts[0].strategy_id, "always-decline");
        assert_eq!(trace.attempts[0].outcome, AttemptOutcome::Declined);
        assert_eq!(trace.attempts[1].strategy_id, "always-1C");
        assert_eq!(trace.attempts[1].outcome, AttemptOutcome::Suggested);
    }

    #[test]
    fn chain_id_concatenates_strategy_ids() {
        let chain = StrategyChain::new(vec![Box::new(AlwaysDecline), Box::new(AlwaysBidOneClub)]);
        assert_eq!(chain.id(), "chain:always-decline+always-1C");
        assert_eq!(chain.name(), "Chain(Always Decline, Always 1C)");
    }

    #[test]
    fn empty_chain_returns_none() {
        let chain = StrategyChain::new(vec![]);
        let ctx = dummy_context();
        assert!(chain.suggest_bid(&ctx).is_none());
    }
}
